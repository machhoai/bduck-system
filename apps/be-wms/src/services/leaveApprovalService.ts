import { randomUUID } from "crypto";
import {
  LeaveApprovalTaskStatus,
  type DecideLeaveApprovalTaskInput,
  type LeaveApprovalTask,
  type LeaveApprovalTaskView,
  type ReassignLeaveApprovalTaskInput,
} from "@bduck/shared-types";
import {
  decideLeaveApprovalTaskTransaction,
} from "../repositories/leaveApprovalActionRepository.js";
import {
  markLeaveApproverUnavailableTransaction,
  reassignLeaveApprovalTaskTransaction,
} from "../repositories/leaveApprovalAvailabilityRepository.js";
import {
  findLeaveApprovalTaskById,
  findLeaveApprovalTasksByRequest,
  findLeaveApprovalTasksByStatus,
  findLeaveEmployeeLabels,
  findLeaveRequestsByIds,
} from "../repositories/leaveApprovalQueryRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";
import {
  hasAvailableLeaveApprover,
  isEligibleLeaveApprover,
} from "./leaveApproverEligibilityService.js";
import { nextWaitingLeaveApprovalTask } from "./leaveApprovalPolicy.js";
import {
  auditLeaveApprovalDecision,
  auditLeaveApprovalReassignment,
  auditLeaveApproverUnavailable,
} from "./leaveApprovalAuditService.js";
import {
  notifyLeaveReassignmentRequired,
  notifyLeaveRequestStatus,
  notifyPendingLeaveApprover,
} from "./leaveNotificationService.js";

const taskNotFound = {
  statusCode: 404,
  messages: {
    vi: "Không tìm thấy nhiệm vụ duyệt nghỉ phép.",
    zh: "未找到休假审批任务。",
  },
};

const toViews = async (
  tasks: LeaveApprovalTask[],
): Promise<LeaveApprovalTaskView[]> => {
  const timestampMillis = (value: unknown): number => {
    if (value instanceof Date) return value.getTime();
    if (
      value &&
      typeof value === "object" &&
      "toMillis" in value &&
      typeof value.toMillis === "function"
    ) {
      return value.toMillis();
    }
    return 0;
  };
  const orderedTasks = [...tasks].sort(
    (left, right) =>
      timestampMillis(right.created_at) - timestampMillis(left.created_at),
  );
  const requests = await findLeaveRequestsByIds(
    orderedTasks.map((task) => task.leave_request_id),
  );
  const employees = await findLeaveEmployeeLabels(
    orderedTasks.map((task) => task.employee_profile_id),
  );
  return orderedTasks.flatMap((task) => {
    const request = requests.get(task.leave_request_id);
    const employee = employees.get(task.employee_profile_id);
    return request
      ? [
          {
            task,
            request,
            employee_name: employee?.name ?? "",
            employee_code: employee?.code ?? "",
          },
        ]
      : [];
  });
};

const reconcilePendingTasks = async (
  actorId: string,
  facilityIds: string[],
) => {
  const allowed = new Set(facilityIds);
  const tasks = (await findLeaveApprovalTasksByStatus(
    LeaveApprovalTaskStatus.PENDING,
  )).filter((task) => allowed.has(task.workplace_warehouse_id));
  for (const task of tasks) {
    const available = await hasAvailableLeaveApprover(
      task.assignment,
      task.workplace_warehouse_id,
      task.employee_user_id,
    );
    if (available) continue;
    const result = await markLeaveApproverUnavailableTransaction({
      task_id: task.id,
      actor_id: actorId,
      action_time: new Date(),
    });
    if (!result) continue;
    await auditLeaveApproverUnavailable(result, actorId);
    void Promise.all([
      notifyLeaveReassignmentRequired(result.task, actorId),
      notifyLeaveRequestStatus(result.request, actorId),
    ]).catch((error) =>
      console.error("[leaveApprovalService] unavailable notice failed:", error),
    );
  }
};

export const fetchMyLeaveApprovalTasks = async (
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveApprovalTaskView[]> => {
  const facilityIds = authorization.facilityIdsFor("leave.approve");
  await reconcilePendingTasks(actorId, facilityIds);
  const tasks = await findLeaveApprovalTasksByStatus(
    LeaveApprovalTaskStatus.PENDING,
  );
  const eligible: LeaveApprovalTask[] = [];
  for (const task of tasks) {
    if (
      facilityIds.includes(task.workplace_warehouse_id) &&
      (await isEligibleLeaveApprover(
        actorId,
        task.assignment,
        task.workplace_warehouse_id,
        task.employee_user_id,
      ))
    ) {
      eligible.push(task);
    }
  }
  return toViews(eligible);
};

export const fetchUnavailableLeaveApprovalTasks = async (
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveApprovalTaskView[]> => {
  const facilityIds = authorization.facilityIdsFor(
    "leave.approver.reassign",
  );
  await reconcilePendingTasks(actorId, facilityIds);
  const allowed = new Set(facilityIds);
  return toViews(
    (
      await findLeaveApprovalTasksByStatus(
        LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
      )
    ).filter((task) => allowed.has(task.workplace_warehouse_id)),
  );
};

export const decideLeaveApprovalTask = async (
  taskId: string,
  input: DecideLeaveApprovalTaskInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const task = await findLeaveApprovalTaskById(taskId);
  if (!task) throw taskNotFound;
  authorization.assert("leave.approve", task.workplace_warehouse_id);
  if (
    !(await isEligibleLeaveApprover(
      actorId,
      task.assignment,
      task.workplace_warehouse_id,
      task.employee_user_id,
    ))
  ) {
    throw {
      statusCode: 403,
      messages: {
        vi: "Bạn không phải người duyệt hợp lệ của cấp hiện tại hoặc không được tự duyệt đơn của mình.",
        zh: "您不是当前级别的有效审批人，或该申请属于您本人。",
      },
    };
  }
  const tasks = await findLeaveApprovalTasksByRequest(
    task.leave_request_id,
    task.approval_attempt,
  );
  const nextTask = nextWaitingLeaveApprovalTask(tasks, task.level);
  const nextAvailable = nextTask
    ? await hasAvailableLeaveApprover(
        nextTask.assignment,
        nextTask.workplace_warehouse_id,
        nextTask.employee_user_id,
      )
    : true;
  const result = await decideLeaveApprovalTaskTransaction({
    task_id: task.id,
    actor_id: actorId,
    decision: input.decision,
    reason: input.reason.trim(),
    action_time: input.action_time,
    posting_date: getVietnamLocalDate(),
    next_level_available: nextAvailable,
  });
  await auditLeaveApprovalDecision(
    result,
    actorId,
    input.decision,
    input.action_time,
  );
  const pendingTask = result.tasks.find(
    (candidate) => candidate.status === LeaveApprovalTaskStatus.PENDING,
  );
  const unavailableTask = result.tasks.find(
    (candidate) =>
      candidate.status === LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
  );
  if (pendingTask) {
    void notifyPendingLeaveApprover(pendingTask, result.request, actorId).catch(
      (error) =>
        console.error("[leaveApprovalService] next approver notice failed:", error),
    );
  }
  if (unavailableTask) {
    void notifyLeaveReassignmentRequired(unavailableTask, actorId).catch(
      (error) =>
        console.error("[leaveApprovalService] reassign notice failed:", error),
    );
  }
  void notifyLeaveRequestStatus(result.request, actorId).catch((error) =>
    console.error("[leaveApprovalService] requester notice failed:", error),
  );
  return result.request;
};

export const reassignLeaveApprovalTask = async (
  taskId: string,
  input: ReassignLeaveApprovalTaskInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const task = await findLeaveApprovalTaskById(taskId);
  if (!task) throw taskNotFound;
  authorization.assert("leave.approver.reassign", task.workplace_warehouse_id);
  if (
    !(await hasAvailableLeaveApprover(
      input.assignment,
      task.workplace_warehouse_id,
      task.employee_user_id,
    ))
  ) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Người/role được chọn không có người duyệt hợp lệ tại nơi làm việc của nhân viên.",
        zh: "所选人员或角色在该员工工作地点没有有效审批人。",
      },
    };
  }
  const result = await reassignLeaveApprovalTaskTransaction({
    task_id: task.id,
    assignment: input.assignment,
    reason: input.reason.trim(),
    actor_id: actorId,
    action_time: input.action_time,
    reassignment_id: randomUUID(),
  });
  await auditLeaveApprovalReassignment(result, actorId, input.action_time);
  void notifyPendingLeaveApprover(result.task, result.request, actorId).catch(
    (error) =>
      console.error("[leaveApprovalService] reassigned notice failed:", error),
  );
  return result.task;
};
