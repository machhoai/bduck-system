import {
  type EmployeeProfile,
  type LeaveBalanceBucket,
  type LeaveLedgerDelta,
  type LeaveLedgerEntry,
  type LeaveLedgerEntryType,
  type LeavePolicy,
  type LocalDate,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  applyLeaveDelta,
  createLeaveLedgerDocumentId,
  getLeaveEntitlementUnits,
} from "../services/leaveBalancePolicy.js";

const BALANCES_COLLECTION = "leave_balance_buckets";
const LEDGER_COLLECTION = "leave_ledger_entries";
const POLICIES_COLLECTION = "leave_policies";
const COMPANY_POLICY_ID = "company";

const withBucketId = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveBalanceBucket => ({
  id: document.id,
  ...(document.data() as Omit<LeaveBalanceBucket, "id">),
});

const withLedgerId = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveLedgerEntry => ({
  id: document.id,
  ...(document.data() as Omit<LeaveLedgerEntry, "id">),
});

export const leaveBalanceBucketIdFor = (
  profileId: string,
  leaveYear: number,
) =>
  `${profileId}_${leaveYear}`;

export const createEmptyLeaveBalanceBucket = (
  profile: EmployeeProfile,
  leaveYear: number,
  now: Date,
): LeaveBalanceBucket => ({
  id: leaveBalanceBucketIdFor(profile.id, leaveYear),
  employee_profile_id: profile.id,
  employee_user_id: profile.user_id,
  workplace_warehouse_id: profile.workplace_warehouse_id,
  leave_year: leaveYear,
  available_units: 0,
  held_units: 0,
  used_units: 0,
  pending_probation_units: 0,
  expired_units: 0,
  last_ledger_entry_id: null,
  is_deleted: false,
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});

export const findCompanyLeavePolicy = async (): Promise<LeavePolicy | null> => {
  const snapshot = await db
    .collection(POLICIES_COLLECTION)
    .doc(COMPANY_POLICY_ID)
    .get();
  if (!snapshot.exists || snapshot.data()?.is_deleted === true) return null;
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<LeavePolicy, "id">),
  };
};

export const saveCompanyLeavePolicy = async (
  policy: LeavePolicy,
): Promise<void> => {
  await db.collection(POLICIES_COLLECTION).doc(COMPANY_POLICY_ID).set(policy);
};

export const findLeaveBalanceBuckets = async (
  employeeProfileId: string,
): Promise<LeaveBalanceBucket[]> => {
  const snapshot = await db
    .collection(BALANCES_COLLECTION)
    .where("employee_profile_id", "==", employeeProfileId)
    .get();
  return snapshot.docs
    .map(withBucketId)
    .filter((bucket) => !bucket.is_deleted)
    .sort((left, right) => right.leave_year - left.leave_year);
};

export const findLeaveLedgerEntries = async (
  employeeProfileId: string,
  resultLimit = 50,
): Promise<LeaveLedgerEntry[]> => {
  const snapshot = await db
    .collection(LEDGER_COLLECTION)
    .where("employee_profile_id", "==", employeeProfileId)
    .get();
  return snapshot.docs
    .map(withLedgerId)
    .sort((left, right) => right.posting_date.localeCompare(left.posting_date))
    .slice(0, resultLimit);
};

export type LeaveLedgerWriteStatus =
  | "APPLIED"
  | "DUPLICATE"
  | "ANNUAL_CAP_REACHED";

export interface ApplyLeaveLedgerEntryInput {
  profile: EmployeeProfile;
  leave_year: number;
  posting_date: LocalDate;
  entry_type: LeaveLedgerEntryType;
  delta: LeaveLedgerDelta;
  idempotency_key: string;
  reason: string;
  created_by: string;
  source_reference?: string | null;
  request_id?: string | null;
  import_batch_id?: string | null;
  annual_cap_units?: number;
  action_time?: Date;
}

export interface ApplyLeaveLedgerEntryResult {
  status: LeaveLedgerWriteStatus;
  entry: LeaveLedgerEntry | null;
  previous_bucket: LeaveBalanceBucket | null;
  bucket: LeaveBalanceBucket | null;
}

export const applyLeaveLedgerEntry = async (
  input: ApplyLeaveLedgerEntryInput,
): Promise<ApplyLeaveLedgerEntryResult> =>
  db.runTransaction(async (transaction) => {
    const now = new Date();
    const ledgerId = createLeaveLedgerDocumentId(input.idempotency_key);
    const ledgerRef = db.collection(LEDGER_COLLECTION).doc(ledgerId);
    const balanceRef = db
      .collection(BALANCES_COLLECTION)
      .doc(leaveBalanceBucketIdFor(input.profile.id, input.leave_year));
    const [ledgerSnapshot, balanceSnapshot] = await Promise.all([
      transaction.get(ledgerRef),
      transaction.get(balanceRef),
    ]);

    if (ledgerSnapshot.exists) {
      return {
        status: "DUPLICATE",
        entry: withLedgerId(ledgerSnapshot),
        previous_bucket: balanceSnapshot.exists
          ? withBucketId(balanceSnapshot)
          : null,
        bucket: balanceSnapshot.exists ? withBucketId(balanceSnapshot) : null,
      };
    }

    const previousBucket = balanceSnapshot.exists
      ? withBucketId(balanceSnapshot)
      : createEmptyLeaveBalanceBucket(input.profile, input.leave_year, now);
    const entitlementDelta =
      input.delta.available_units +
      input.delta.held_units +
      input.delta.used_units +
      input.delta.pending_probation_units +
      input.delta.expired_units;
    if (
      input.annual_cap_units !== undefined &&
      getLeaveEntitlementUnits(previousBucket) + Math.max(0, entitlementDelta) >
        input.annual_cap_units
    ) {
      return {
        status: "ANNUAL_CAP_REACHED",
        entry: null,
        previous_bucket: previousBucket,
        bucket: previousBucket,
      };
    }

    const projectedBucket = applyLeaveDelta(previousBucket, input.delta);
    const bucket: LeaveBalanceBucket = {
      ...projectedBucket,
      employee_user_id: input.profile.user_id,
      workplace_warehouse_id: input.profile.workplace_warehouse_id,
      last_ledger_entry_id: ledgerId,
      updated_at: now,
      action_time: input.action_time ?? now,
      sync_time: now,
    };
    const entry: LeaveLedgerEntry = {
      id: ledgerId,
      employee_profile_id: input.profile.id,
      employee_user_id: input.profile.user_id,
      workplace_warehouse_id: input.profile.workplace_warehouse_id,
      leave_year: input.leave_year,
      posting_date: input.posting_date,
      entry_type: input.entry_type,
      delta: input.delta,
      request_id: input.request_id ?? null,
      import_batch_id: input.import_batch_id ?? null,
      source_reference: input.source_reference ?? null,
      idempotency_key: input.idempotency_key,
      reason: input.reason,
      created_by: input.created_by,
      created_at: now,
      action_time: input.action_time ?? now,
      sync_time: now,
    };

    transaction.set(balanceRef, bucket);
    transaction.set(ledgerRef, entry);
    return {
      status: "APPLIED",
      entry,
      previous_bucket: balanceSnapshot.exists ? previousBucket : null,
      bucket,
    };
  });
