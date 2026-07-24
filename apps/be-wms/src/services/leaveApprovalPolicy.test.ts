import assert from "node:assert/strict";
import test from "node:test";
import {
  LeaveApprovalTaskStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  type LeaveApprovalLevel,
  type LeaveRequest,
} from "@bduck/shared-types";
import {
  buildLeaveApprovalTasks,
  nextWaitingLeaveApprovalTask,
  normalizeLeaveApprovalLevels,
  planLeaveApprovalDecision,
  isLeaveApprovalActorEligible,
} from "./leaveApprovalPolicy.js";

const request = {
  id: "request-1",
  employee_profile_id: "profile-1",
  employee_user_id: "employee-1",
  workplace_warehouse_id: "facility-1",
  request_type: LeaveRequestType.PAID_ANNUAL,
  status: LeaveRequestStatus.DRAFT,
  approval_attempt: 0,
  action_time: new Date("2026-07-23T00:00:00Z"),
} as LeaveRequest;
const levels: LeaveApprovalLevel[] = [1, 2, 3].map((level) => ({
  level: level as 1 | 2 | 3,
  enabled: true,
  label: { vi: `Cấp ${level}`, zh: `第 ${level} 级` },
  assignment: {
    mode: "ROLE",
    role_id: `role-${level}`,
    assigned_user_id: null,
  },
}));

test("only the first enabled approval level becomes pending", () => {
  const tasks = buildLeaveApprovalTasks({
    request,
    levels,
    first_level_available: true,
    actor_id: request.employee_user_id,
    now: new Date(),
  });
  assert.deepEqual(
    tasks.map((task) => task.status),
    [
      LeaveApprovalTaskStatus.PENDING,
      LeaveApprovalTaskStatus.WAITING,
      LeaveApprovalTaskStatus.WAITING,
    ],
  );
  assert.equal(nextWaitingLeaveApprovalTask(tasks, 1)?.level, 2);
});

test("unavailable first approver blocks only the active level", () => {
  const tasks = buildLeaveApprovalTasks({
    request,
    levels,
    first_level_available: false,
    actor_id: request.employee_user_id,
    now: new Date(),
  });
  assert.equal(
    tasks[0].status,
    LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
  );
  assert.equal(tasks[1].status, LeaveApprovalTaskStatus.WAITING);
});

test("approval configuration requires at least one enabled level", () => {
  assert.throws(() =>
    normalizeLeaveApprovalLevels(
      levels.map((level) => ({ ...level, enabled: false })),
    ),
  );
});

test("enabled approval levels execute in ascending configured order", () => {
  const normalized = normalizeLeaveApprovalLevels([
    levels[2],
    levels[0],
  ]);
  assert.deepEqual(
    normalized.map((level) => level.level),
    [1, 3],
  );
});

test("approving a level opens only the next waiting level", () => {
  const tasks = buildLeaveApprovalTasks({
    request,
    levels,
    first_level_available: true,
    actor_id: request.employee_user_id,
    now: new Date(),
  });
  const plan = planLeaveApprovalDecision({
    tasks,
    current_task: tasks[0],
    decision: "APPROVE",
    next_level_available: true,
  });
  assert.equal(plan.current_task_status, LeaveApprovalTaskStatus.APPROVED);
  assert.equal(plan.next_task_id, tasks[1].id);
  assert.equal(plan.next_task_status, LeaveApprovalTaskStatus.PENDING);
  assert.equal(plan.request_status, LeaveRequestStatus.PENDING_APPROVAL);
  assert.equal(plan.terminal, false);
});

test("an unavailable next level blocks the request without completing it", () => {
  const tasks = buildLeaveApprovalTasks({
    request,
    levels,
    first_level_available: true,
    actor_id: request.employee_user_id,
    now: new Date(),
  });
  const plan = planLeaveApprovalDecision({
    tasks,
    current_task: tasks[0],
    decision: "APPROVE",
    next_level_available: false,
  });
  assert.equal(
    plan.next_task_status,
    LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
  );
  assert.equal(
    plan.request_status,
    LeaveRequestStatus.APPROVER_UNAVAILABLE,
  );
  assert.equal(plan.terminal, false);
});

test("approving the final level completes the request", () => {
  const tasks = buildLeaveApprovalTasks({
    request,
    levels: [levels[0]],
    first_level_available: true,
    actor_id: request.employee_user_id,
    now: new Date(),
  });
  const plan = planLeaveApprovalDecision({
    tasks,
    current_task: tasks[0],
    decision: "APPROVE",
    next_level_available: true,
  });
  assert.equal(plan.next_task_id, null);
  assert.equal(plan.request_status, LeaveRequestStatus.APPROVED);
  assert.equal(plan.terminal, true);
});

test("rejecting cancels every unopened level and completes the request", () => {
  const tasks = buildLeaveApprovalTasks({
    request,
    levels,
    first_level_available: true,
    actor_id: request.employee_user_id,
    now: new Date(),
  });
  const plan = planLeaveApprovalDecision({
    tasks,
    current_task: tasks[0],
    decision: "REJECT",
    next_level_available: true,
  });
  assert.deepEqual(plan.cancelled_task_ids, [tasks[1].id, tasks[2].id]);
  assert.equal(plan.request_status, LeaveRequestStatus.REJECTED);
  assert.equal(plan.terminal, true);
});

test("an employee can never approve their own request", () => {
  assert.equal(
    isLeaveApprovalActorEligible({
      actor_id: "employee-1",
      employee_user_id: "employee-1",
      assignment: levels[0].assignment,
      has_permission: true,
      has_assigned_role: true,
    }),
    false,
  );
});

test("role and user assignments require an exact effective match", () => {
  assert.equal(
    isLeaveApprovalActorEligible({
      actor_id: "approver-1",
      employee_user_id: "employee-1",
      assignment: levels[0].assignment,
      has_permission: true,
      has_assigned_role: false,
    }),
    false,
  );
  assert.equal(
    isLeaveApprovalActorEligible({
      actor_id: "approver-1",
      employee_user_id: "employee-1",
      assignment: {
        mode: "USER",
        role_id: null,
        assigned_user_id: "approver-2",
      },
      has_permission: true,
      has_assigned_role: false,
    }),
    false,
  );
});
