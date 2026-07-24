import type {
  LeaveApprovalTask,
  LeaveRequest,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const TASKS = "leave_approval_tasks";
const REQUESTS = "leave_requests";

const mapTask = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveApprovalTask => ({
  id: document.id,
  ...(document.data() as Omit<LeaveApprovalTask, "id">),
});

export const findLeaveApprovalTaskById = async (
  taskId: string,
): Promise<LeaveApprovalTask | null> => {
  const snapshot = await db.collection(TASKS).doc(taskId).get();
  return snapshot.exists ? mapTask(snapshot) : null;
};

export const findLeaveApprovalTasksByStatus = async (
  status: LeaveApprovalTask["status"],
): Promise<LeaveApprovalTask[]> => {
  const snapshot = await db
    .collection(TASKS)
    .where("status", "==", status)
    .where("is_deleted", "==", false)
    .get();
  return snapshot.docs.map(mapTask);
};

export const findLeaveApprovalTasksByRequest = async (
  requestId: string,
  approvalAttempt: number,
): Promise<LeaveApprovalTask[]> => {
  const snapshot = await db
    .collection(TASKS)
    .where("leave_request_id", "==", requestId)
    .where("approval_attempt", "==", approvalAttempt)
    .get();
  return snapshot.docs
    .map(mapTask)
    .sort((left, right) => left.level - right.level);
};

export const findLeaveApprovalTasksByRequestIds = async (
  requestIds: string[],
): Promise<LeaveApprovalTask[]> => {
  const uniqueIds = Array.from(new Set(requestIds));
  const tasks: LeaveApprovalTask[] = [];
  for (let index = 0; index < uniqueIds.length; index += 30) {
    const ids = uniqueIds.slice(index, index + 30);
    if (!ids.length) continue;
    const snapshot = await db
      .collection(TASKS)
      .where("leave_request_id", "in", ids)
      .where("is_deleted", "==", false)
      .get();
    tasks.push(...snapshot.docs.map(mapTask));
  }
  return tasks.sort((left, right) => left.level - right.level);
};

export const findLeaveRequestsByIds = async (
  requestIds: string[],
): Promise<Map<string, LeaveRequest>> => {
  const uniqueIds = Array.from(new Set(requestIds));
  const result = new Map<string, LeaveRequest>();
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const references = uniqueIds
      .slice(index, index + 100)
      .map((id) => db.collection(REQUESTS).doc(id));
    if (!references.length) continue;
    const snapshots = await db.getAll(...references);
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;
      result.set(snapshot.id, {
        id: snapshot.id,
        ...(snapshot.data() as Omit<LeaveRequest, "id">),
      });
    });
  }
  return result;
};

export const findLeaveEmployeeLabels = async (
  profileIds: string[],
): Promise<Map<string, { name: string; code: string }>> => {
  const uniqueIds = Array.from(new Set(profileIds));
  const result = new Map<string, { name: string; code: string }>();
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const references = uniqueIds
      .slice(index, index + 100)
      .map((id) => db.collection("employee_profiles").doc(id));
    if (!references.length) continue;
    const snapshots = await db.getAll(...references);
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;
      result.set(snapshot.id, {
        name: String(snapshot.data()?.full_name ?? ""),
        code: String(snapshot.data()?.employee_code ?? ""),
      });
    });
  }
  return result;
};
