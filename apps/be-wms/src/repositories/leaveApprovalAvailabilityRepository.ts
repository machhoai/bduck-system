import {
  LeaveApprovalTaskStatus,
  LeaveRequestStatus,
  type LeaveApprovalAssignment,
  type LeaveApprovalReassignment,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const TASKS = "leave_approval_tasks";
const REQUESTS = "leave_requests";
const REASSIGNMENTS = "leave_approval_reassignments";
const map = <T>(snapshot: FirebaseFirestore.DocumentSnapshot): T =>
  ({ id: snapshot.id, ...snapshot.data() }) as T;

export interface LeaveApprovalReassignResult {
  previous_request: LeaveRequest;
  request: LeaveRequest;
  previous_task: LeaveApprovalTask;
  task: LeaveApprovalTask;
  reassignment: LeaveApprovalReassignment;
}

export type LeaveApprovalAvailabilityResult = Omit<
  LeaveApprovalReassignResult,
  "reassignment"
>;

export const markLeaveApproverUnavailableTransaction = async (input: {
  task_id: string;
  actor_id: string;
  action_time: Date;
}): Promise<LeaveApprovalAvailabilityResult | null> =>
  db.runTransaction(async (transaction) => {
    const taskReference = db.collection(TASKS).doc(input.task_id);
    const taskSnapshot = await transaction.get(taskReference);
    if (!taskSnapshot.exists) return null;
    const previousTask = map<LeaveApprovalTask>(taskSnapshot);
    if (previousTask.status !== LeaveApprovalTaskStatus.PENDING) return null;
    const requestReference = db
      .collection(REQUESTS)
      .doc(previousTask.leave_request_id);
    const requestSnapshot = await transaction.get(requestReference);
    if (!requestSnapshot.exists) return null;
    const previousRequest = map<LeaveRequest>(requestSnapshot);
    if (previousRequest.status !== LeaveRequestStatus.PENDING_APPROVAL) {
      return null;
    }
    const now = new Date();
    const task: LeaveApprovalTask = {
      ...previousTask,
      status: LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    const request: LeaveRequest = {
      ...previousRequest,
      status: LeaveRequestStatus.APPROVER_UNAVAILABLE,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    transaction.set(taskReference, task);
    transaction.set(requestReference, request);
    return {
      previous_request: previousRequest,
      request,
      previous_task: previousTask,
      task,
    };
  });

export const reassignLeaveApprovalTaskTransaction = async (input: {
  task_id: string;
  assignment: LeaveApprovalAssignment;
  reason: string;
  actor_id: string;
  action_time: Date;
  reassignment_id: string;
}): Promise<LeaveApprovalReassignResult> =>
  db.runTransaction(async (transaction) => {
    const taskReference = db.collection(TASKS).doc(input.task_id);
    const taskSnapshot = await transaction.get(taskReference);
    if (!taskSnapshot.exists) throw new Error("LEAVE_APPROVAL_TASK_NOT_FOUND");
    const previousTask = map<LeaveApprovalTask>(taskSnapshot);
    if (
      previousTask.status !== LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE
    ) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Chỉ có thể đổi người duyệt cho nhiệm vụ đang thiếu người duyệt hợp lệ.",
          zh: "仅可为当前无有效审批人的任务重新指派审批人。",
        },
      };
    }
    const requestReference = db
      .collection(REQUESTS)
      .doc(previousTask.leave_request_id);
    const requestSnapshot = await transaction.get(requestReference);
    if (!requestSnapshot.exists) throw new Error("LEAVE_REQUEST_NOT_FOUND");
    const previousRequest = map<LeaveRequest>(requestSnapshot);
    if (
      previousRequest.status !== LeaveRequestStatus.APPROVER_UNAVAILABLE
    ) {
      throw new Error("LEAVE_REQUEST_NOT_UNAVAILABLE");
    }
    const now = new Date();
    const task: LeaveApprovalTask = {
      ...previousTask,
      assignment: input.assignment,
      status: LeaveApprovalTaskStatus.PENDING,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    const request: LeaveRequest = {
      ...previousRequest,
      status: LeaveRequestStatus.PENDING_APPROVAL,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    const reassignment: LeaveApprovalReassignment = {
      id: input.reassignment_id,
      leave_request_id: previousTask.leave_request_id,
      approval_task_id: previousTask.id,
      workplace_warehouse_id: previousTask.workplace_warehouse_id,
      approval_attempt: previousTask.approval_attempt,
      level: previousTask.level,
      previous_assignment: previousTask.assignment,
      next_assignment: input.assignment,
      reason: input.reason,
      reassigned_by: input.actor_id,
      created_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    transaction.set(taskReference, task);
    transaction.set(requestReference, request);
    transaction.create(
      db.collection(REASSIGNMENTS).doc(reassignment.id),
      reassignment,
    );
    return {
      previous_request: previousRequest,
      request,
      previous_task: previousTask,
      task,
      reassignment,
    };
  });
