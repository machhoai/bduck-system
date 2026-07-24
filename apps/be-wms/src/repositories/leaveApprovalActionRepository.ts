import {
  LeaveApprovalTaskStatus,
  LeaveLedgerEntryType,
  LeaveRequestStatus,
  type LeaveApprovalTask,
  type LeaveBalanceBucket,
  type LeaveDayReservation,
  type LeaveLedgerEntry,
  type LeaveRequest,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  applyLeaveDelta,
  createLeaveLedgerDocumentId,
  createZeroLeaveDelta,
} from "../services/leaveBalancePolicy.js";
import { leaveBalanceBucketIdFor } from "./leaveBalanceRepository.js";
import { planLeaveApprovalDecision } from "../services/leaveApprovalPolicy.js";

const TASKS = "leave_approval_tasks";
const REQUESTS = "leave_requests";
const BALANCES = "leave_balance_buckets";
const LEDGER = "leave_ledger_entries";
const RESERVATIONS = "leave_day_reservations";

const map = <T>(snapshot: FirebaseFirestore.DocumentSnapshot): T =>
  ({ id: snapshot.id, ...snapshot.data() }) as T;

export interface LeaveApprovalActionResult {
  previous_request: LeaveRequest;
  request: LeaveRequest;
  previous_tasks: LeaveApprovalTask[];
  tasks: LeaveApprovalTask[];
  previous_buckets: LeaveBalanceBucket[];
  buckets: LeaveBalanceBucket[];
  ledger_entries: LeaveLedgerEntry[];
}

export const decideLeaveApprovalTaskTransaction = async (input: {
  task_id: string;
  actor_id: string;
  decision: "APPROVE" | "REJECT";
  reason: string;
  action_time: Date;
  posting_date: string;
  next_level_available: boolean;
}): Promise<LeaveApprovalActionResult> =>
  db.runTransaction(async (transaction) => {
    const taskReference = db.collection(TASKS).doc(input.task_id);
    const taskSnapshot = await transaction.get(taskReference);
    if (!taskSnapshot.exists) throw new Error("LEAVE_APPROVAL_TASK_NOT_FOUND");
    const currentTask = map<LeaveApprovalTask>(taskSnapshot);
    if (currentTask.status !== LeaveApprovalTaskStatus.PENDING) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Nhiệm vụ duyệt này không còn ở trạng thái chờ xử lý.",
          zh: "该审批任务已不再处于待处理状态。",
        },
      };
    }
    const requestReference = db
      .collection(REQUESTS)
      .doc(currentTask.leave_request_id);
    const [requestSnapshot, tasksSnapshot] = await Promise.all([
      transaction.get(requestReference),
      transaction.get(
        db
          .collection(TASKS)
          .where("leave_request_id", "==", currentTask.leave_request_id)
          .where("approval_attempt", "==", currentTask.approval_attempt),
      ),
    ]);
    if (!requestSnapshot.exists) throw new Error("LEAVE_REQUEST_NOT_FOUND");
    const previousRequest = map<LeaveRequest>(requestSnapshot);
    if (previousRequest.status !== LeaveRequestStatus.PENDING_APPROVAL) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Đơn nghỉ phép không còn chờ duyệt.",
          zh: "休假申请已不再等待审批。",
        },
      };
    }
    const previousTasks = tasksSnapshot.docs
      .map((snapshot) => map<LeaveApprovalTask>(snapshot))
      .sort((left, right) => left.level - right.level);
    const now = new Date();
    const plan = planLeaveApprovalDecision({
      tasks: previousTasks,
      current_task: currentTask,
      decision: input.decision,
      next_level_available: input.next_level_available,
    });
    const tasks = previousTasks.map((task) => {
      if (task.id === currentTask.id) {
        return {
          ...task,
          status: plan.current_task_status,
          acted_by: input.actor_id,
          acted_at: now,
          decision_reason: input.reason || null,
          updated_by: input.actor_id,
          updated_at: now,
          action_time: input.action_time,
          sync_time: now,
        };
      }
      if (plan.cancelled_task_ids.includes(task.id)) {
        return task.status === LeaveApprovalTaskStatus.WAITING
          ? {
              ...task,
              status: LeaveApprovalTaskStatus.CANCELLED,
              updated_by: input.actor_id,
              updated_at: now,
              action_time: input.action_time,
              sync_time: now,
            }
          : task;
      }
      if (task.id === plan.next_task_id && plan.next_task_status) {
        return {
          ...task,
          status: plan.next_task_status,
          updated_by: input.actor_id,
          updated_at: now,
          action_time: input.action_time,
          sync_time: now,
        };
      }
      return task;
    });

    const terminal = plan.terminal;
    const bucketReferences = terminal
      ? previousRequest.balance_allocations.map((allocation) =>
          db
            .collection(BALANCES)
            .doc(
              leaveBalanceBucketIdFor(
                previousRequest.employee_profile_id,
                allocation.leave_year,
              ),
            ),
        )
      : [];
    const bucketSnapshots = bucketReferences.length
      ? await transaction.getAll(...bucketReferences)
      : [];
    const ledgerReferences = terminal
      ? previousRequest.balance_allocations.map((allocation) =>
          db.collection(LEDGER).doc(
            createLeaveLedgerDocumentId(
              `${input.decision === "APPROVE" ? "request-approved" : "request-rejected"}:${previousRequest.id}:${allocation.leave_year}`,
            ),
          ),
        )
      : [];
    const ledgerSnapshots = ledgerReferences.length
      ? await transaction.getAll(...ledgerReferences)
      : [];
    if (ledgerSnapshots.some((snapshot) => snapshot.exists)) {
      throw new Error("LEAVE_APPROVAL_LEDGER_ALREADY_POSTED");
    }
    const reservationReferences =
      input.decision === "REJECT"
        ? previousRequest.days.map((day) =>
            db
              .collection(RESERVATIONS)
              .doc(`${previousRequest.employee_profile_id}_${day.date}`),
          )
        : [];
    const reservationSnapshots = reservationReferences.length
      ? await transaction.getAll(...reservationReferences)
      : [];
    const previousBuckets = bucketSnapshots.map((snapshot) => {
      if (!snapshot.exists) throw new Error("LEAVE_BALANCE_BUCKET_NOT_FOUND");
      return map<LeaveBalanceBucket>(snapshot);
    });
    const buckets: LeaveBalanceBucket[] = [];
    const ledgerEntries: LeaveLedgerEntry[] = [];
    previousRequest.balance_allocations.forEach((allocation, index) => {
      if (!terminal) return;
      const previous = previousBuckets[index];
      const delta =
        input.decision === "APPROVE"
          ? {
              ...createZeroLeaveDelta(),
              held_units: -allocation.units,
              used_units: allocation.units,
            }
          : {
              ...createZeroLeaveDelta(),
              available_units: allocation.units,
              held_units: -allocation.units,
            };
      const bucket = {
        ...applyLeaveDelta(previous, delta),
        last_ledger_entry_id: ledgerReferences[index].id,
        updated_at: now,
        action_time: input.action_time,
        sync_time: now,
      };
      const entry: LeaveLedgerEntry = {
        id: ledgerReferences[index].id,
        employee_profile_id: previousRequest.employee_profile_id,
        employee_user_id: previousRequest.employee_user_id,
        workplace_warehouse_id: previousRequest.workplace_warehouse_id,
        leave_year: allocation.leave_year,
        posting_date: input.posting_date,
        entry_type:
          input.decision === "APPROVE"
            ? LeaveLedgerEntryType.REQUEST_APPROVED
            : LeaveLedgerEntryType.REQUEST_RELEASED,
        delta,
        request_id: previousRequest.id,
        import_batch_id: null,
        source_reference: null,
        idempotency_key: `${input.decision === "APPROVE" ? "request-approved" : "request-rejected"}:${previousRequest.id}:${allocation.leave_year}`,
        reason:
          input.decision === "APPROVE"
            ? "LEAVE_REQUEST_APPROVED"
            : "LEAVE_REQUEST_REJECTED",
        created_by: input.actor_id,
        created_at: now,
        action_time: input.action_time,
        sync_time: now,
      };
      buckets.push(bucket);
      ledgerEntries.push(entry);
      transaction.set(bucketReferences[index], bucket);
      transaction.set(ledgerReferences[index], entry);
    });
    if (input.decision === "REJECT") {
      reservationSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) return;
        const previous = map<LeaveDayReservation>(snapshot);
        const reservation = {
          ...previous,
          morning_request_id:
            previous.morning_request_id === previousRequest.id
              ? null
              : previous.morning_request_id,
          afternoon_request_id:
            previous.afternoon_request_id === previousRequest.id
              ? null
              : previous.afternoon_request_id,
          updated_at: now,
          action_time: input.action_time,
          sync_time: now,
        };
        reservation.is_deleted =
          !reservation.morning_request_id && !reservation.afternoon_request_id;
        transaction.set(reservationReferences[index], reservation);
      });
    }
    const request: LeaveRequest = {
      ...previousRequest,
      status: plan.request_status,
      completed_at: terminal ? now : null,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    tasks.forEach((task) =>
      transaction.set(db.collection(TASKS).doc(task.id), task),
    );
    transaction.set(requestReference, request);
    return {
      previous_request: previousRequest,
      request,
      previous_tasks: previousTasks,
      tasks,
      previous_buckets: previousBuckets,
      buckets,
      ledger_entries: ledgerEntries,
    };
  });
