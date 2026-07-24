import {
  LeaveApprovalTaskStatus,
  LeaveRequestStatus,
  type LeaveApprovalLevel,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";

export const leaveApprovalTaskId = (
  requestId: string,
  approvalAttempt: number,
  level: number,
) => `${requestId}_${approvalAttempt}_${level}`;

export const normalizeLeaveApprovalLevels = (
  levels: LeaveApprovalLevel[],
): LeaveApprovalLevel[] => {
  const positions = new Set(levels.map((level) => level.level));
  const enabled = levels.filter((level) => level.enabled);
  if (
    levels.length < 1 ||
    levels.length > 3 ||
    positions.size !== levels.length ||
    enabled.length < 1
  ) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Cấu hình phải có từ 1 đến 3 cấp và ít nhất 1 cấp đang bật.",
        zh: "审批配置必须包含 1 至 3 级，且至少启用一级。",
      },
    };
  }
  return [...levels].sort((left, right) => left.level - right.level);
};

export const buildLeaveApprovalTasks = (input: {
  request: LeaveRequest;
  levels: LeaveApprovalLevel[];
  first_level_available: boolean;
  actor_id: string;
  now: Date;
}): LeaveApprovalTask[] => {
  const active = input.levels
    .filter((level) => level.enabled)
    .sort((left, right) => left.level - right.level);
  return active.map((level, index) => ({
    id: leaveApprovalTaskId(
      input.request.id,
      input.request.approval_attempt + 1,
      level.level,
    ),
    leave_request_id: input.request.id,
    employee_profile_id: input.request.employee_profile_id,
    employee_user_id: input.request.employee_user_id,
    workplace_warehouse_id: input.request.workplace_warehouse_id,
    approval_attempt: input.request.approval_attempt + 1,
    level: level.level,
    label: level.label,
    status:
      index > 0
        ? LeaveApprovalTaskStatus.WAITING
        : input.first_level_available
          ? LeaveApprovalTaskStatus.PENDING
          : LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
    assignment: level.assignment,
    acted_by: null,
    acted_at: null,
    decision_reason: null,
    created_by: input.actor_id,
    updated_by: input.actor_id,
    is_deleted: false,
    created_at: input.now,
    updated_at: input.now,
    action_time: input.request.action_time,
    sync_time: input.now,
  }));
};

export const nextWaitingLeaveApprovalTask = (
  tasks: LeaveApprovalTask[],
  currentLevel: number,
): LeaveApprovalTask | null =>
  [...tasks]
    .filter(
      (task) =>
        task.status === LeaveApprovalTaskStatus.WAITING &&
        task.level > currentLevel,
    )
    .sort((left, right) => left.level - right.level)[0] ?? null;

export const isLeaveApprovalActorEligible = (input: {
  actor_id: string;
  employee_user_id: string;
  assignment: LeaveApprovalTask["assignment"];
  has_permission: boolean;
  has_assigned_role: boolean;
}): boolean => {
  if (
    input.actor_id === input.employee_user_id ||
    !input.has_permission
  ) {
    return false;
  }
  return input.assignment.mode === "USER"
    ? input.assignment.assigned_user_id === input.actor_id
    : input.has_assigned_role;
};

export interface LeaveApprovalDecisionPlan {
  current_task_status:
    | LeaveApprovalTaskStatus.APPROVED
    | LeaveApprovalTaskStatus.REJECTED;
  next_task_id: string | null;
  next_task_status:
    | LeaveApprovalTaskStatus.PENDING
    | LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE
    | null;
  cancelled_task_ids: string[];
  request_status:
    | LeaveRequestStatus.PENDING_APPROVAL
    | LeaveRequestStatus.APPROVER_UNAVAILABLE
    | LeaveRequestStatus.APPROVED
    | LeaveRequestStatus.REJECTED;
  terminal: boolean;
}

export const planLeaveApprovalDecision = (input: {
  tasks: LeaveApprovalTask[];
  current_task: LeaveApprovalTask;
  decision: "APPROVE" | "REJECT";
  next_level_available: boolean;
}): LeaveApprovalDecisionPlan => {
  if (input.current_task.status !== LeaveApprovalTaskStatus.PENDING) {
    throw new Error("LEAVE_APPROVAL_TASK_NOT_PENDING");
  }
  const nextTask = nextWaitingLeaveApprovalTask(
    input.tasks,
    input.current_task.level,
  );
  if (input.decision === "REJECT") {
    return {
      current_task_status: LeaveApprovalTaskStatus.REJECTED,
      next_task_id: null,
      next_task_status: null,
      cancelled_task_ids: input.tasks
        .filter((task) => task.status === LeaveApprovalTaskStatus.WAITING)
        .map((task) => task.id),
      request_status: LeaveRequestStatus.REJECTED,
      terminal: true,
    };
  }
  if (!nextTask) {
    return {
      current_task_status: LeaveApprovalTaskStatus.APPROVED,
      next_task_id: null,
      next_task_status: null,
      cancelled_task_ids: [],
      request_status: LeaveRequestStatus.APPROVED,
      terminal: true,
    };
  }
  return {
    current_task_status: LeaveApprovalTaskStatus.APPROVED,
    next_task_id: nextTask.id,
    next_task_status: input.next_level_available
      ? LeaveApprovalTaskStatus.PENDING
      : LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
    cancelled_task_ids: [],
    request_status: input.next_level_available
      ? LeaveRequestStatus.PENDING_APPROVAL
      : LeaveRequestStatus.APPROVER_UNAVAILABLE,
    terminal: false,
  };
};
