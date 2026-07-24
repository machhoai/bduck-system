import { randomUUID } from "crypto";
import {
  AuditAction,
  EmployeeEmploymentStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  type CreateLeaveRequestInput,
  type EmployeeProfile,
  type LeaveApprovalConfig,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";
import { getEmployeeProfileByUserId } from "../repositories/employeeProfileRepository.js";
import { findCompanyHolidays } from "../repositories/leaveHolidayRepository.js";
import {
  createDraftLeaveRequest,
  findCompanyLeaveApprovalConfig,
  findLeaveRequestById,
  findLeaveRequestsByProfile,
} from "../repositories/leaveRequestQueryRepository.js";
import {
  submitLeaveRequestTransaction,
  type LeaveRequestTransactionResult,
} from "../repositories/leaveRequestRepository.js";
import {
  cancelLeaveRequestTransaction,
  type CancelLeaveRequestTransactionResult,
} from "../repositories/leaveRequestCancellationRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit } from "./auditService.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";
import { evaluateLeaveDateSelection } from "./leavePolicy.js";
import { hasAvailableLeaveApprover } from "./leaveApproverEligibilityService.js";
import { buildLeaveApprovalTasks } from "./leaveApprovalPolicy.js";
import {
  notifyLeaveReassignmentRequired,
  notifyLeaveRequestStatus,
  notifyPendingLeaveApprover,
} from "./leaveNotificationService.js";

const profileNotFound = {
  statusCode: 404,
  messages: {
    vi: "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.",
    zh: "当前账户尚未关联员工档案。",
  },
};

const dispatchSubmissionNotifications = (
  result: LeaveRequestTransactionResult,
  actorId: string,
) => {
  const pending = result.approval_tasks.find(
    (task) => task.status === "PENDING",
  );
  const unavailable = result.approval_tasks.find(
    (task) => task.status === "APPROVER_UNAVAILABLE",
  );
  if (pending) {
    void notifyPendingLeaveApprover(pending, result.request, actorId).catch(
      (error) =>
        console.error("[leaveRequestService] notify approver failed:", error),
    );
  }
  if (unavailable) {
    void Promise.all([
      notifyLeaveReassignmentRequired(unavailable, actorId),
      notifyLeaveRequestStatus(result.request, actorId),
    ]).catch((error) =>
      console.error("[leaveRequestService] notify unavailable failed:", error),
    );
  }
};

const loadSelfProfile = async (
  userId: string,
  authorization: AuthorizationService,
  permission: "leave.self.read" | "leave.request.create",
) => {
  const profile = await getEmployeeProfileByUserId(userId);
  if (!profile || profile.user_id !== userId) throw profileNotFound;
  authorization.assert(permission, profile.workplace_warehouse_id);
  return profile;
};

const assertApprovalConfigReady = (
  config: LeaveApprovalConfig | null,
): LeaveApprovalConfig => {
  const enabledLevels = config?.levels.filter((level) => level.enabled) ?? [];
  if (enabledLevels.length < 1 || enabledLevels.length > 3) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Chưa có cấu hình duyệt nghỉ phép hợp lệ. Vui lòng liên hệ HR.",
        zh: "尚未配置有效的休假审批流程，请联系 HR。",
      },
    };
  }
  return config!;
};

const validateRequest = async (
  profile: EmployeeProfile,
  requestType: LeaveRequestType,
  selections: CreateLeaveRequestInput["days"],
) => {
  if (
    requestType === LeaveRequestType.PAID_ANNUAL &&
    profile.employment_status !== EmployeeEmploymentStatus.OFFICIAL
  ) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Nhân viên thử việc chưa thể sử dụng ngày phép năm.",
        zh: "试用期员工暂不能使用带薪年假。",
      },
    };
  }
  const sortedDates = selections.map((item) => item.date).sort();
  const holidays = sortedDates.length
    ? await findCompanyHolidays(sortedDates[0], sortedDates.at(-1)!)
    : [];
  const result = evaluateLeaveDateSelection(selections, {
    holiday_dates: new Set(holidays.map((holiday) => holiday.holiday_date)),
  });
  if (!result.valid) {
    throw {
      statusCode: 400,
      messages: result.issues[0].messages,
      issues: result.issues,
    };
  }
  return result;
};

const writeTransactionAudits = async (
  result: LeaveRequestTransactionResult | CancelLeaveRequestTransactionResult,
  actorId: string,
  action: AuditAction,
) => {
  await Promise.all([
    logAudit({
      entity_type: "leave_requests",
      entity_id: result.request.id,
      warehouse_id: result.request.workplace_warehouse_id,
      action,
      user_id: actorId,
      old_value: result.previous_request as unknown as Record<
        string,
        unknown
      > | null,
      new_value: result.request as unknown as Record<string, unknown>,
      action_time: result.request.action_time,
    }),
    ...result.buckets.map((bucket) =>
      logAudit({
        entity_type: "leave_balance_buckets",
        entity_id: bucket.id,
        warehouse_id: bucket.workplace_warehouse_id,
        action: AuditAction.UPDATE,
        user_id: actorId,
        old_value: result.previous_buckets.find(
          (previous) => previous.id === bucket.id,
        ) as unknown as Record<string, unknown>,
        new_value: bucket as unknown as Record<string, unknown>,
        action_time: result.request.action_time,
      }),
    ),
    ...result.ledger_entries.map((entry) =>
      logAudit({
        entity_type: "leave_ledger_entries",
        entity_id: entry.id,
        warehouse_id: entry.workplace_warehouse_id,
        action: AuditAction.CREATE,
        user_id: actorId,
        old_value: null,
        new_value: entry as unknown as Record<string, unknown>,
        action_time: entry.action_time,
      }),
    ),
    ...("approval_tasks" in result
      ? result.approval_tasks.map((task: LeaveApprovalTask) => {
          const previousTask =
            "previous_approval_tasks" in result
              ? result.previous_approval_tasks.find(
                  (previous) => previous.id === task.id,
                )
              : null;
          return (
          logAudit({
            entity_type: "leave_approval_tasks",
            entity_id: task.id,
            warehouse_id: task.workplace_warehouse_id,
            action: previousTask ? AuditAction.UPDATE : AuditAction.CREATE,
            user_id: actorId,
            old_value:
              (previousTask as unknown as Record<string, unknown>) ?? null,
            new_value: task as unknown as Record<string, unknown>,
            action_time: task.action_time,
          })
          );
        })
      : []),
  ]);
};

const prepareApprovalTasks = async (
  request: LeaveRequest,
  config: LeaveApprovalConfig,
  actorId: string,
) => {
  const levels = config.levels
    .filter((level) => level.enabled)
    .sort((left, right) => left.level - right.level);
  const firstLevelAvailable = await hasAvailableLeaveApprover(
    levels[0].assignment,
    request.workplace_warehouse_id,
    request.employee_user_id,
  );
  return buildLeaveApprovalTasks({
    request,
    levels,
    first_level_available: firstLevelAvailable,
    actor_id: actorId,
    now: new Date(),
  });
};

const buildRequest = (
  input: CreateLeaveRequestInput,
  profile: EmployeeProfile,
  actorId: string,
  normalized: Awaited<ReturnType<typeof validateRequest>>,
): LeaveRequest => {
  const now = new Date();
  return {
    id: randomUUID(),
    employee_profile_id: profile.id,
    employee_user_id: actorId,
    workplace_warehouse_id: profile.workplace_warehouse_id,
    request_type: input.request_type,
    status: LeaveRequestStatus.DRAFT,
    days: normalized.normalized_days,
    total_units: normalized.total_units,
    reason: input.reason.trim(),
    cancellation_reason: null,
    balance_allocations: [],
    approval_attempt: 0,
    submitted_at: null,
    completed_at: null,
    created_by: actorId,
    updated_by: actorId,
    source: "USER_REQUEST",
    source_reference: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  };
};

export const createMyLeaveRequest = async (
  input: CreateLeaveRequestInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const profile = await loadSelfProfile(
    actorId,
    authorization,
    "leave.request.create",
  );
  const normalized = await validateRequest(
    profile,
    input.request_type,
    input.days,
  );
  const request = buildRequest(input, profile, actorId, normalized);
  if (!input.submit) {
    await createDraftLeaveRequest(request);
    await logAudit({
      entity_type: "leave_requests",
      entity_id: request.id,
      warehouse_id: request.workplace_warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: request as unknown as Record<string, unknown>,
      action_time: input.action_time,
    });
    return request;
  }
  const config = assertApprovalConfigReady(
    await findCompanyLeaveApprovalConfig(),
  );
  const approvalTasks = await prepareApprovalTasks(request, config, actorId);
  const result = await submitLeaveRequestTransaction({
    request,
    profile,
    expect_draft: false,
    posting_date: getVietnamLocalDate(),
    approval_tasks: approvalTasks,
  });
  await writeTransactionAudits(result, actorId, AuditAction.CREATE);
  dispatchSubmissionNotifications(result, actorId);
  return result.request;
};

export const submitMyLeaveRequest = async (
  requestId: string,
  actorId: string,
  actionTime: Date,
  authorization: AuthorizationService,
) => {
  const profile = await loadSelfProfile(
    actorId,
    authorization,
    "leave.request.create",
  );
  const existing = await findLeaveRequestById(requestId);
  if (
    !existing ||
    existing.employee_user_id !== actorId ||
    existing.status !== LeaveRequestStatus.DRAFT
  ) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy đơn nháp có thể gửi.",
        zh: "未找到可提交的草稿申请。",
      },
    };
  }
  await validateRequest(profile, existing.request_type, existing.days);
  const config = assertApprovalConfigReady(
    await findCompanyLeaveApprovalConfig(),
  );
  const approvalTasks = await prepareApprovalTasks(
    { ...existing, action_time: actionTime },
    config,
    actorId,
  );
  const result = await submitLeaveRequestTransaction({
    request: {
      ...existing,
      action_time: actionTime,
      updated_by: actorId,
    },
    profile,
    expect_draft: true,
    posting_date: getVietnamLocalDate(),
    approval_tasks: approvalTasks,
  });
  await writeTransactionAudits(result, actorId, AuditAction.UPDATE);
  dispatchSubmissionNotifications(result, actorId);
  return result.request;
};

export const fetchMyLeaveRequests = async (
  actorId: string,
  authorization: AuthorizationService,
) => {
  const profile = await loadSelfProfile(
    actorId,
    authorization,
    "leave.self.read",
  );
  return findLeaveRequestsByProfile(profile.id);
};

export const cancelMyLeaveRequest = async (
  requestId: string,
  reason: string,
  actionTime: Date,
  actorId: string,
  authorization: AuthorizationService,
) => {
  await loadSelfProfile(actorId, authorization, "leave.request.create");
  const result = await cancelLeaveRequestTransaction({
    request_id: requestId,
    actor_id: actorId,
    reason,
    action_time: actionTime,
    posting_date: getVietnamLocalDate(),
  });
  await writeTransactionAudits(result, actorId, AuditAction.CANCEL);
  return result.request;
};
