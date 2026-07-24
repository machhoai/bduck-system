import {
  LeaveLedgerEntryType,
  LeaveApprovalTaskStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  type EmployeeProfile,
  type LeaveBalanceBucket,
  type LeaveDayReservation,
  type LeaveLedgerEntry,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  createEmptyLeaveBalanceBucket,
  leaveBalanceBucketIdFor,
} from "./leaveBalanceRepository.js";
import {
  applyLeaveDelta,
  createLeaveLedgerDocumentId,
  createZeroLeaveDelta,
} from "../services/leaveBalancePolicy.js";
import { allocatePaidLeaveUnits } from "../services/leaveRequestPolicy.js";

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

export interface LeaveRequestTransactionResult {
  previous_request: LeaveRequest | null;
  request: LeaveRequest;
  previous_buckets: LeaveBalanceBucket[];
  buckets: LeaveBalanceBucket[];
  ledger_entries: LeaveLedgerEntry[];
  approval_tasks: LeaveApprovalTask[];
}

const assertReservationAvailable = (
  reservation: LeaveDayReservation | null,
  request: LeaveRequest,
) => {
  if (!reservation || reservation.is_deleted) return;
  const day = request.days.find((item) => item.date === reservation.leave_date);
  if (!day) return;
  const needsMorning = day.portion !== "AFTERNOON";
  const needsAfternoon = day.portion !== "MORNING";
  if (
    (needsMorning &&
      reservation.morning_request_id &&
      reservation.morning_request_id !== request.id) ||
    (needsAfternoon &&
      reservation.afternoon_request_id &&
      reservation.afternoon_request_id !== request.id)
  ) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Ngày ${day.date} đã có trong một đơn nghỉ phép khác.`,
        zh: `${day.date} 已存在于其他休假申请中。`,
      },
    };
  }
};

export const submitLeaveRequestTransaction = async (input: {
  request: LeaveRequest;
  profile: EmployeeProfile;
  expect_draft: boolean;
  posting_date: string;
  approval_tasks: LeaveApprovalTask[];
}): Promise<LeaveRequestTransactionResult> =>
  db.runTransaction(async (transaction) => {
    const requestReference = db.collection(REQUESTS).doc(input.request.id);
    const requestSnapshot = await transaction.get(requestReference);
    const previousRequest = requestSnapshot.exists
      ? withRequest(requestSnapshot)
      : null;
    if (
      (input.expect_draft &&
        (!previousRequest ||
          previousRequest.status !== LeaveRequestStatus.DRAFT)) ||
      (!input.expect_draft && previousRequest)
    ) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Đơn nghỉ phép không còn ở trạng thái có thể gửi.",
          zh: "休假申请已不处于可提交状态。",
        },
      };
    }

    const bucketSnapshot = await transaction.get(
      db
        .collection(BALANCES)
        .where("employee_profile_id", "==", input.profile.id),
    );
    const previousBuckets = bucketSnapshot.docs
      .map(withBucket)
      .filter((bucket) => !bucket.is_deleted);
    const reservationReferences = input.request.days.map((day) =>
      db
        .collection(RESERVATIONS)
        .doc(reservationId(input.profile.id, day.date)),
    );
    const reservationSnapshots = reservationReferences.length
      ? await transaction.getAll(...reservationReferences)
      : [];
    const previousReservations = reservationSnapshots.map((snapshot) =>
      snapshot.exists ? withReservation(snapshot) : null,
    );
    previousReservations.forEach((reservation) =>
      assertReservationAvailable(reservation, input.request),
    );

    const allocation =
      input.request.request_type === LeaveRequestType.PAID_ANNUAL
        ? allocatePaidLeaveUnits(input.request.days, previousBuckets)
        : { allocations: [], insufficient_units: 0 };
    if (allocation.insufficient_units > 0) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Số ngày phép khả dụng không đủ cho các ngày đã chọn.",
          zh: "可用年假不足以覆盖所选日期。",
        },
      };
    }

    const ledgerReferences = allocation.allocations.map((item) =>
      db.collection(LEDGER).doc(
        createLeaveLedgerDocumentId(
          `request-hold:${input.request.id}:${item.leave_year}`,
        ),
      ),
    );
    const ledgerSnapshots = ledgerReferences.length
      ? await transaction.getAll(...ledgerReferences)
      : [];
    if (ledgerSnapshots.some((snapshot) => snapshot.exists)) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Đơn nghỉ phép này đã được giữ số dư trước đó.",
          zh: "该休假申请此前已冻结余额。",
        },
      };
    }

    const now = new Date();
    const buckets: LeaveBalanceBucket[] = [];
    const entries: LeaveLedgerEntry[] = [];
    allocation.allocations.forEach((item, index) => {
      const previous =
        previousBuckets.find(
          (bucket) => bucket.leave_year === item.leave_year,
        ) ??
        createEmptyLeaveBalanceBucket(input.profile, item.leave_year, now);
      const delta = {
        ...createZeroLeaveDelta(),
        available_units: -item.units,
        held_units: item.units,
      };
      const ledgerId = ledgerReferences[index].id;
      const bucket: LeaveBalanceBucket = {
        ...applyLeaveDelta(previous, delta),
        last_ledger_entry_id: ledgerId,
        updated_at: now,
        action_time: input.request.action_time,
        sync_time: now,
      };
      const entry: LeaveLedgerEntry = {
        id: ledgerId,
        employee_profile_id: input.profile.id,
        employee_user_id: input.profile.user_id,
        workplace_warehouse_id: input.profile.workplace_warehouse_id,
        leave_year: item.leave_year,
        posting_date: input.posting_date,
        entry_type: LeaveLedgerEntryType.REQUEST_HOLD,
        delta,
        request_id: input.request.id,
        import_batch_id: null,
        source_reference: null,
        idempotency_key: `request-hold:${input.request.id}:${item.leave_year}`,
        reason: "LEAVE_REQUEST_SUBMITTED",
        created_by: input.request.created_by,
        created_at: now,
        action_time: input.request.action_time,
        sync_time: now,
      };
      buckets.push(bucket);
      entries.push(entry);
      transaction.set(db.collection(BALANCES).doc(bucket.id), bucket);
      transaction.set(ledgerReferences[index], entry);
    });

    input.request.days.forEach((day, index) => {
      const previous = previousReservations[index];
      const occupiesMorning = day.portion !== "AFTERNOON";
      const occupiesAfternoon = day.portion !== "MORNING";
      const reservation: LeaveDayReservation = {
        id: reservationReferences[index].id,
        employee_profile_id: input.profile.id,
        employee_user_id: input.profile.user_id,
        workplace_warehouse_id: input.profile.workplace_warehouse_id,
        leave_date: day.date,
        morning_request_id: occupiesMorning
          ? input.request.id
          : previous?.morning_request_id ?? null,
        afternoon_request_id: occupiesAfternoon
          ? input.request.id
          : previous?.afternoon_request_id ?? null,
        is_deleted: false,
        created_at: previous?.created_at ?? now,
        updated_at: now,
        action_time: input.request.action_time,
        sync_time: now,
      };
      transaction.set(reservationReferences[index], reservation);
    });

    const request: LeaveRequest = {
      ...input.request,
      status:
        input.approval_tasks[0]?.status ===
        LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE
          ? LeaveRequestStatus.APPROVER_UNAVAILABLE
          : LeaveRequestStatus.PENDING_APPROVAL,
      balance_allocations: allocation.allocations,
      approval_attempt: input.request.approval_attempt + 1,
      submitted_at: now,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(requestReference, request);
    input.approval_tasks.forEach((task) => {
      transaction.create(db.collection(APPROVAL_TASKS).doc(task.id), task);
    });
    return {
      previous_request: previousRequest,
      request,
      previous_buckets: previousBuckets,
      buckets,
      ledger_entries: entries,
      approval_tasks: input.approval_tasks,
    };
  });
