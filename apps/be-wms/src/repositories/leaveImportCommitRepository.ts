import {
  LeaveImportRecordType,
  type EmployeeProfile,
  type LeaveBalanceBucket,
  type LeaveImportNormalizedPayload,
  type LeaveImportRow,
  LeaveLedgerEntryType,
  type LeaveLedgerEntry,
  type LeaveRequest,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";
import { db } from "../config/firebase.js";
import {
  createEmptyLeaveBalanceBucket,
  leaveBalanceBucketIdFor,
} from "./leaveBalanceRepository.js";
import {
  applyLeaveDelta,
  createLeaveLedgerDocumentId,
} from "../services/leaveBalancePolicy.js";
import { buildLeaveImportDelta } from "../services/leaveImportPolicy.js";

const ROW_COLLECTION = "leave_import_rows";
const BALANCE_COLLECTION = "leave_balance_buckets";
const LEDGER_COLLECTION = "leave_ledger_entries";
const REQUEST_COLLECTION = "leave_requests";

export interface LeaveImportRowCommitResult {
  previous_row: LeaveImportRow;
  row: LeaveImportRow;
  duplicate: boolean;
  previous_bucket: LeaveBalanceBucket | null;
  bucket: LeaveBalanceBucket | null;
  ledger_entry: LeaveLedgerEntry | null;
  request: LeaveRequest | null;
}

const withRowId = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): LeaveImportRow => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<LeaveImportRow, "id">),
});

const withBucketId = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): LeaveBalanceBucket => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<LeaveBalanceBucket, "id">),
});

const historicalRequestId = (profileId: string, sourceReference: string) =>
  `historical_${createHash("sha256")
    .update(`${profileId}:${sourceReference}`)
    .digest("hex")
    .slice(0, 40)}`;

const historicalInstant = (postingDate: string): Date =>
  new Date(`${postingDate}T05:00:00.000Z`);

const sameDelta = (
  left: LeaveLedgerEntry["delta"],
  right: LeaveLedgerEntry["delta"],
) =>
  left.available_units === right.available_units &&
  left.held_units === right.held_units &&
  left.used_units === right.used_units &&
  left.pending_probation_units === right.pending_probation_units &&
  left.expired_units === right.expired_units;

const buildHistoricalRequest = (input: {
  id: string;
  row: LeaveImportRow;
  payload: LeaveImportNormalizedPayload;
  profile: EmployeeProfile;
  actor_id: string;
  now: Date;
}): LeaveRequest => {
  const units = input.payload.units ?? 0;
  const status = input.payload.request_status as LeaveRequestStatus;
  const completedAt = historicalInstant(input.payload.posting_date);
  const usesPaidBalance =
    status === LeaveRequestStatus.APPROVED &&
    input.payload.request_type === LeaveRequestType.PAID_ANNUAL;
  return {
    id: input.id,
    employee_profile_id: input.profile.id,
    employee_user_id: input.profile.user_id ?? "",
    workplace_warehouse_id: input.profile.workplace_warehouse_id,
    request_type: input.payload.request_type as LeaveRequestType,
    status,
    days: [
      {
        date: input.payload.posting_date,
        portion: input.payload.day_portion!,
        units: units as 0.5 | 1,
      },
    ],
    total_units: units,
    reason: input.payload.reason,
    cancellation_reason:
      status === LeaveRequestStatus.CANCELLED
        ? input.payload.reason
        : null,
    balance_allocations: usesPaidBalance
      ? [{ leave_year: input.payload.leave_year, units }]
      : [],
    approval_attempt: 0,
    submitted_at: completedAt,
    completed_at: completedAt,
    created_by: input.actor_id,
    updated_by: input.actor_id,
    source: "HISTORICAL_IMPORT",
    source_reference: input.row.source_reference,
    is_deleted: false,
    created_at: input.now,
    updated_at: input.now,
    action_time: completedAt,
    sync_time: input.now,
  };
};

export const commitLeaveImportRow = async (input: {
  row_id: string;
  profile: EmployeeProfile;
  actor_id: string;
  action_time: Date;
}): Promise<LeaveImportRowCommitResult> =>
  db.runTransaction(async (transaction) => {
    const now = new Date();
    const rowRef = db.collection(ROW_COLLECTION).doc(input.row_id);
    const rowSnapshot = await transaction.get(rowRef);
    if (!rowSnapshot.exists) throw new Error("LEAVE_IMPORT_ROW_NOT_FOUND");
    const currentRow = withRowId(rowSnapshot);
    if (currentRow.committed_at) {
      return {
        previous_row: currentRow,
        row: currentRow,
        duplicate: true,
        previous_bucket: null,
        bucket: null,
        ledger_entry: null,
        request: null,
      };
    }
    if (!currentRow.is_valid) throw new Error("LEAVE_IMPORT_ROW_INVALID");

    const payload =
      currentRow.normalized_payload as unknown as LeaveImportNormalizedPayload;
    const recordType = currentRow.record_type as LeaveImportRecordType;
    const delta = buildLeaveImportDelta(recordType, payload);
    const idempotencyKey =
      `leave_import:${input.profile.id}:${recordType}:` +
      currentRow.source_reference;
    const ledgerId = createLeaveLedgerDocumentId(idempotencyKey);
    const balanceRef = db
      .collection(BALANCE_COLLECTION)
      .doc(leaveBalanceBucketIdFor(input.profile.id, payload.leave_year));
    const ledgerRef = db.collection(LEDGER_COLLECTION).doc(ledgerId);
    const isHistorical =
      recordType === LeaveImportRecordType.HISTORICAL_REQUEST;
    const requestRef = isHistorical
      ? db
          .collection(REQUEST_COLLECTION)
          .doc(historicalRequestId(input.profile.id, currentRow.source_reference))
      : null;
    const [balanceSnapshot, ledgerSnapshot, requestSnapshot] =
      await Promise.all([
        delta ? transaction.get(balanceRef) : Promise.resolve(null),
        delta ? transaction.get(ledgerRef) : Promise.resolve(null),
        requestRef ? transaction.get(requestRef) : Promise.resolve(null),
      ]);
    if (delta && ledgerSnapshot?.exists) {
      const existing = {
        id: ledgerSnapshot.id,
        ...(ledgerSnapshot.data() as Omit<LeaveLedgerEntry, "id">),
      };
      if (
        existing.employee_profile_id !== input.profile.id ||
        existing.leave_year !== payload.leave_year ||
        existing.posting_date !== payload.posting_date ||
        existing.reason !== payload.reason ||
        !sameDelta(existing.delta, delta)
      ) {
        throw new Error("LEAVE_IMPORT_SOURCE_REFERENCE_CONFLICT");
      }
    }

    let previousBucket: LeaveBalanceBucket | null = null;
    let bucket: LeaveBalanceBucket | null = null;
    let ledgerEntry: LeaveLedgerEntry | null = null;
    if (delta && balanceSnapshot && !ledgerSnapshot?.exists) {
      previousBucket = balanceSnapshot.exists
        ? withBucketId(balanceSnapshot)
        : null;
      const base =
        previousBucket ??
        createEmptyLeaveBalanceBucket(
          input.profile,
          payload.leave_year,
          now,
        );
      bucket = {
        ...applyLeaveDelta(base, delta),
        employee_user_id: input.profile.user_id,
        workplace_warehouse_id: input.profile.workplace_warehouse_id,
        last_ledger_entry_id: ledgerId,
        updated_at: now,
        action_time: historicalInstant(payload.posting_date),
        sync_time: now,
      };
      ledgerEntry = {
        id: ledgerId,
        employee_profile_id: input.profile.id,
        employee_user_id: input.profile.user_id,
        workplace_warehouse_id: input.profile.workplace_warehouse_id,
        leave_year: payload.leave_year,
        posting_date: payload.posting_date,
        entry_type: LeaveLedgerEntryType.HISTORICAL_IMPORT,
        delta,
        request_id: requestRef?.id ?? null,
        import_batch_id: currentRow.batch_id,
        source_reference: currentRow.source_reference,
        idempotency_key: idempotencyKey,
        reason: payload.reason,
        created_by: input.actor_id,
        created_at: now,
        action_time: historicalInstant(payload.posting_date),
        sync_time: now,
      };
      transaction.set(balanceRef, bucket);
      transaction.set(ledgerRef, ledgerEntry);
    }

    let request: LeaveRequest | null = null;
    const expectedRequest = requestRef
      ? buildHistoricalRequest({
        id: requestRef.id,
        row: currentRow,
        payload,
        profile: input.profile,
        actor_id: input.actor_id,
        now,
      })
      : null;
    if (expectedRequest && requestSnapshot?.exists) {
      const existing = {
        id: requestSnapshot.id,
        ...(requestSnapshot.data() as Omit<LeaveRequest, "id">),
      };
      if (
        existing.employee_profile_id !== expectedRequest.employee_profile_id ||
        existing.request_type !== expectedRequest.request_type ||
        existing.status !== expectedRequest.status ||
        existing.total_units !== expectedRequest.total_units ||
        existing.reason !== expectedRequest.reason ||
        existing.days[0]?.date !== expectedRequest.days[0]?.date ||
        existing.days[0]?.portion !== expectedRequest.days[0]?.portion
      ) {
        throw new Error("LEAVE_IMPORT_SOURCE_REFERENCE_CONFLICT");
      }
    }
    if (requestRef && expectedRequest && !requestSnapshot?.exists) {
      request = expectedRequest;
      transaction.set(requestRef, request);
    }
    const row: LeaveImportRow = {
      ...currentRow,
      committed_at: now,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    transaction.set(rowRef, row);
    return {
      previous_row: currentRow,
      row,
      duplicate:
        (!delta || Boolean(ledgerSnapshot?.exists)) &&
        (!requestRef || Boolean(requestSnapshot?.exists)),
      previous_bucket: previousBucket,
      bucket,
      ledger_entry: ledgerEntry,
      request,
    };
  });
