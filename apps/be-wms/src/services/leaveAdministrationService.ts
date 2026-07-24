import {
  AuditAction,
  LEAVE_ACCRUAL_DAY_OF_MONTH,
  LEAVE_CARRYOVER_EXPIRY_DAY,
  LEAVE_CARRYOVER_EXPIRY_MONTH,
  LEAVE_TIMEZONE,
  LeaveLedgerEntryType,
  type EmployeeProfile,
  type LeavePolicy,
  type LeaveRequestAdminView,
  type ManualLeaveBalanceAdjustmentInput,
  type UpsertLeavePolicyInput,
} from "@bduck/shared-types";
import {
  findEmployeeProfilesScoped,
  getEmployeeProfileById,
} from "../repositories/employeeProfileRepository.js";
import {
  findCompanyLeavePolicy,
  findLeaveBalanceBuckets,
  findLeaveLedgerEntries,
  saveCompanyLeavePolicy,
} from "../repositories/leaveBalanceRepository.js";
import {
  findLeaveApprovalTasksByRequestIds,
  findLeaveEmployeeLabels,
} from "../repositories/leaveApprovalQueryRepository.js";
import { findLeaveRequestsScoped } from "../repositories/leaveRequestQueryRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit } from "./auditService.js";
import {
  applyLeaveLedgerEntryWithAudit,
} from "./leaveBalanceService.js";
import {
  buildLeaveBalanceSummary,
} from "./leaveBalancePolicy.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";
import {
  assertValidCompanyLeavePolicy,
  buildManualLeaveAdjustmentDelta,
} from "./leaveAdministrationPolicy.js";

const assertAnyPermission = (
  authorization: AuthorizationService,
  permission: string,
) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor(permission).length === 0
  ) {
    throw { statusCode: 403 };
  }
};

const loadProfile = async (
  profileId: string,
  authorization: AuthorizationService,
  permission: "leave.requests.read_all" | "leave.balance.adjust",
) => {
  const profile = await getEmployeeProfileById(profileId);
  if (!profile) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy hồ sơ nhân viên.",
        zh: "未找到员工档案。",
      },
    };
  }
  if (!authorization.context.isSystemAdmin) {
    authorization.assert(permission, profile.workplace_warehouse_id);
  }
  return profile;
};

const buildProfileSummary = async (profile: EmployeeProfile) => {
  const [buckets, entries] = await Promise.all([
    findLeaveBalanceBuckets(profile.id),
    findLeaveLedgerEntries(profile.id),
  ]);
  return buildLeaveBalanceSummary({
    employee_profile_id: profile.id,
    as_of_date: getVietnamLocalDate(),
    buckets,
    recent_entries: entries,
  });
};

export const fetchCompanyLeavePolicy = async (
  authorization: AuthorizationService,
) => {
  assertAnyPermission(authorization, "leave.config.manage");
  return findCompanyLeavePolicy();
};

export const updateCompanyLeavePolicy = async (
  input: UpsertLeavePolicyInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  assertAnyPermission(authorization, "leave.config.manage");
  assertValidCompanyLeavePolicy(input);
  const previous = await findCompanyLeavePolicy();
  const now = new Date();
  const policy: LeavePolicy = {
    id: "company",
    scope: "COMPANY",
    timezone: LEAVE_TIMEZONE,
    accrual_day_of_month: LEAVE_ACCRUAL_DAY_OF_MONTH,
    monthly_accrual_units: input.monthly_accrual_units,
    annual_cap_units: input.annual_cap_units,
    carryover_expiry_month: LEAVE_CARRYOVER_EXPIRY_MONTH,
    carryover_expiry_day: LEAVE_CARRYOVER_EXPIRY_DAY,
    probation_accrual_locked: true,
    created_by: previous?.created_by ?? actorId,
    updated_by: actorId,
    is_deleted: false,
    created_at: previous?.created_at ?? now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  };
  await saveCompanyLeavePolicy(policy);
  await logAudit({
    entity_type: "leave_policies",
    entity_id: policy.id,
    warehouse_id: null,
    action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: previous as unknown as Record<string, unknown> | null,
    new_value: policy as unknown as Record<string, unknown>,
    action_time: input.action_time,
  });
  return policy;
};

export const fetchCompanyLeaveRequests = async (
  authorization: AuthorizationService,
): Promise<LeaveRequestAdminView[]> => {
  assertAnyPermission(authorization, "leave.requests.read_all");
  const requests = await findLeaveRequestsScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("leave.requests.read_all"),
  });
  const [tasks, labels] = await Promise.all([
    findLeaveApprovalTasksByRequestIds(requests.map((request) => request.id)),
    findLeaveEmployeeLabels(
      requests.map((request) => request.employee_profile_id),
    ),
  ]);
  return requests.map((request) => {
    const employee = labels.get(request.employee_profile_id);
    return {
      request,
      employee_name: employee?.name ?? "",
      employee_code: employee?.code ?? "",
      approval_tasks: tasks.filter(
        (task) =>
          task.leave_request_id === request.id &&
          task.approval_attempt === request.approval_attempt,
      ),
    };
  });
};

export const fetchLeaveBalanceAdjustmentProfiles = async (
  authorization: AuthorizationService,
) => {
  assertAnyPermission(authorization, "leave.balance.adjust");
  return findEmployeeProfilesScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("leave.balance.adjust"),
  });
};

export const fetchEmployeeLeaveBalance = async (
  profileId: string,
  authorization: AuthorizationService,
) => {
  const profile = await getEmployeeProfileById(profileId);
  if (!profile) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy hồ sơ nhân viên.",
        zh: "未找到员工档案。",
      },
    };
  }
  if (
    !authorization.context.isSystemAdmin &&
    !authorization.can(
      "leave.requests.read_all",
      profile.workplace_warehouse_id,
    ) &&
    !authorization.can("leave.balance.adjust", profile.workplace_warehouse_id)
  ) {
    throw { statusCode: 403 };
  }
  return buildProfileSummary(profile);
};

export const adjustEmployeeLeaveBalance = async (
  profileId: string,
  input: ManualLeaveBalanceAdjustmentInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const profile = await loadProfile(
    profileId,
    authorization,
    "leave.balance.adjust",
  );
  const result = await applyLeaveLedgerEntryWithAudit({
    profile,
    leave_year: input.leave_year,
    posting_date: input.posting_date,
    entry_type: LeaveLedgerEntryType.MANUAL_ADJUSTMENT,
    delta: buildManualLeaveAdjustmentDelta(input.available_units_delta),
    idempotency_key: `manual-adjustment:${profile.id}:${input.idempotency_key}`,
    reason: input.reason,
    created_by: actorId,
    action_time: input.action_time,
  });
  if (!result.entry) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Không thể áp dụng điều chỉnh số dư ngày phép.",
        zh: "无法应用假期余额调整。",
      },
    };
  }
  return {
    summary: await buildProfileSummary(profile),
    ledger_entry: result.entry,
  };
};
