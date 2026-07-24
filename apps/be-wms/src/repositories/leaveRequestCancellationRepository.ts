import {
  LeaveLedgerEntryType,
  LeaveApprovalTaskStatus,
  LeaveRequestStatus,
  type LeaveBalanceBucket,
  type LeaveDayReservation,
  type LeaveLedgerEntry,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  applyLeaveDelta,
  createLeaveLedgerDocumentId,
  createZeroLeaveDelta,
} from "../services/leaveBalancePolicy.js";
import { leaveBalanceBucketIdFor } from "./leaveBalanceRepository.js";

const REQUESTS = "leave_requests";
const RESERVATIONS = "leave_day_reservations";
const BALANCES = "leave_balance_buckets";
const LEDGER = "leave_ledger_entries";
const APPROVAL_TASKS = "leave_approval_tasks";

const withRequest = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveRequest => ({
  id: document.id,
  ...(document.data() as Omit<LeaveRequest, "id">),
});
const withBucket = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveBalanceBucket => ({
  id: document.id,
  ...(document.data() as Omit<LeaveBalanceBucket, "id">),
});
const withReservation = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveDayReservation => ({
  id: document.id,
  ...(document.data() as Omit<LeaveDayReservation, "id">),
});
const reservationId = (profileId: string, date: string) =>
  `${profileId}_${date}`;

export interface CancelLeaveRequestTransactionResult {
  previous_request: LeaveRequest;
  request: LeaveRequest;
  previous_buckets: LeaveBalanceBucket[];
  buckets: LeaveBalanceBucket[];
  ledger_entries: LeaveLedgerEntry[];
  previous_approval_tasks: LeaveApprovalTask[];
  approval_tasks: LeaveApprovalTask[];
}

export const cancelLeaveRequestTransaction = async (input: {
  request_id: string;
  actor_id: string;
  reason: string;
  action_time: Date;
  posting_date: string;
}): Promise<CancelLeaveRequestTransactionResult> =>
  db.runTransaction(async (transaction) => {
    const requestReference = db.collection(REQUESTS).doc(input.request_id);
    const requestSnapshot = await transaction.get(requestReference);
    if (!requestSnapshot.exists) {
      throw {
        statusCode: 404,
        messages: {
          vi: "Không tìm thấy đơn nghỉ phép.",
          zh: "未找到休假申请。",
        },
      };
    }
    const previousRequest = withRequest(requestSnapshot);
    if (previousRequest.employee_user_id !== input.actor_id) {
      throw {
        statusCode: 403,
        messages: {
          vi: "Bạn chỉ có thể hủy đơn nghỉ phép của chính mình.",
          zh: "您只能取消自己的休假申请。",
        },
      };
    }
    if (
      previousRequest.status !== LeaveRequestStatus.DRAFT &&
      previousRequest.status !== LeaveRequestStatus.PENDING_APPROVAL &&
      previousRequest.status !== LeaveRequestStatus.APPROVER_UNAVAILABLE
    ) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Trạng thái hiện tại không cho phép hủy đơn.",
          zh: "当前状态不允许取消申请。",
        },
      };
    }

    const bucketReferences = previousRequest.balance_allocations.map((item) =>
      db
        .collection(BALANCES)
        .doc(
          leaveBalanceBucketIdFor(
            previousRequest.employee_profile_id,
            item.leave_year,
          ),
        ),
    );
    const wasSubmitted =
      previousRequest.status === LeaveRequestStatus.PENDING_APPROVAL ||
      previousRequest.status === LeaveRequestStatus.APPROVER_UNAVAILABLE;
    const reservationReferences =
      wasSubmitted
        ? previousRequest.days.map((day) =>
            db
              .collection(RESERVATIONS)
              .doc(
                reservationId(previousRequest.employee_profile_id, day.date),
              ),
          )
        : [];
    const bucketSnapshots = bucketReferences.length
      ? await transaction.getAll(...bucketReferences)
      : [];
    const reservationSnapshots = reservationReferences.length
      ? await transaction.getAll(...reservationReferences)
      : [];
    const ledgerReferences = previousRequest.balance_allocations.map((item) =>
      db.collection(LEDGER).doc(
        createLeaveLedgerDocumentId(
          `request-release:${previousRequest.id}:${item.leave_year}`,
        ),
      ),
    );
    const ledgerSnapshots = ledgerReferences.length
      ? await transaction.getAll(...ledgerReferences)
      : [];
    const taskSnapshot = wasSubmitted
      ? await transaction.get(
          db
            .collection(APPROVAL_TASKS)
            .where("leave_request_id", "==", previousRequest.id)
            .where("approval_attempt", "==", previousRequest.approval_attempt),
        )
      : null;
    if (ledgerSnapshots.some((snapshot) => snapshot.exists)) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Số dư của đơn này đã được hoàn trả trước đó.",
          zh: "该申请的余额此前已释放。",
        },
      };
    }

    const now = new Date();
    const previousBuckets = bucketSnapshots.map((snapshot) => {
      if (!snapshot.exists) throw new Error("LEAVE_BALANCE_BUCKET_NOT_FOUND");
      return withBucket(snapshot);
    });
    const buckets: LeaveBalanceBucket[] = [];
    const entries: LeaveLedgerEntry[] = [];
    const previousApprovalTasks =
      taskSnapshot?.docs.map(
        (document) =>
          ({
            id: document.id,
            ...document.data(),
          }) as LeaveApprovalTask,
      ) ?? [];
    const approvalTasks = previousApprovalTasks.map((task) => ({
      ...task,
      status:
        task.status === LeaveApprovalTaskStatus.APPROVED
          ? task.status
          : LeaveApprovalTaskStatus.CANCELLED,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    }));
    previousRequest.balance_allocations.forEach((allocation, index) => {
      const previous = previousBuckets[index];
      const delta = {
        ...createZeroLeaveDelta(),
        available_units: allocation.units,
        held_units: -allocation.units,
      };
      const ledgerId = ledgerReferences[index].id;
      const bucket: LeaveBalanceBucket = {
        ...applyLeaveDelta(previous, delta),
        last_ledger_entry_id: ledgerId,
        updated_at: now,
        action_time: input.action_time,
        sync_time: now,
      };
      const entry: LeaveLedgerEntry = {
        id: ledgerId,
        employee_profile_id: previousRequest.employee_profile_id,
        employee_user_id: previousRequest.employee_user_id,
        workplace_warehouse_id: previousRequest.workplace_warehouse_id,
        leave_year: allocation.leave_year,
        posting_date: input.posting_date,
        entry_type: LeaveLedgerEntryType.REQUEST_RELEASED,
        delta,
        request_id: previousRequest.id,
        import_batch_id: null,
        source_reference: null,
        idempotency_key: `request-release:${previousRequest.id}:${allocation.leave_year}`,
        reason: "LEAVE_REQUEST_CANCELLED",
        created_by: input.actor_id,
        created_at: now,
        action_time: input.action_time,
        sync_time: now,
      };
      buckets.push(bucket);
      entries.push(entry);
      transaction.set(bucketReferences[index], bucket);
      transaction.set(ledgerReferences[index], entry);
    });

    reservationSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const previous = withReservation(snapshot);
      const reservation: LeaveDayReservation = {
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
    approvalTasks.forEach((task) =>
      transaction.set(db.collection(APPROVAL_TASKS).doc(task.id), task),
    );

    const request: LeaveRequest = {
      ...previousRequest,
      status: LeaveRequestStatus.CANCELLED,
      cancellation_reason: input.reason,
      completed_at: now,
      updated_by: input.actor_id,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    transaction.set(requestReference, request);
    return {
      previous_request: previousRequest,
      request,
      previous_buckets: previousBuckets,
      buckets,
      ledger_entries: entries,
      previous_approval_tasks: previousApprovalTasks,
      approval_tasks: approvalTasks,
    };
  });
