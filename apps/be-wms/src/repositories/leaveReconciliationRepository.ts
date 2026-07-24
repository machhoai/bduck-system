import {
  AuditAction,
  type EmployeeProfile,
  type LeaveBalanceBucket,
  type LeaveBalanceReconciliationItem,
  type LeaveBalanceReconciliationReport,
  type LeaveLedgerEntry,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";
import { db } from "../config/firebase.js";
import { createEmptyLeaveBalanceBucket } from "./leaveBalanceRepository.js";

const BALANCES_COLLECTION = "leave_balance_buckets";
const LEDGER_COLLECTION = "leave_ledger_entries";
const RUNS_COLLECTION = "leave_reconciliation_runs";

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

export const loadLeaveReconciliationSource = async () => {
  const [ledgerSnapshot, bucketSnapshot] = await Promise.all([
    db.collection(LEDGER_COLLECTION).get(),
    db.collection(BALANCES_COLLECTION).where("is_deleted", "==", false).get(),
  ]);
  return {
    ledgerEntries: ledgerSnapshot.docs.map(withLedgerId),
    buckets: bucketSnapshot.docs.map(withBucketId),
  };
};

const currentMatchesObservation = (
  current: LeaveBalanceBucket | null,
  item: LeaveBalanceReconciliationItem,
) => {
  if (!current || !item.actual) return current === null && item.actual === null;
  return (
    current.available_units === item.actual.available_units &&
    current.held_units === item.actual.held_units &&
    current.used_units === item.actual.used_units &&
    current.pending_probation_units === item.actual.pending_probation_units &&
    current.expired_units === item.actual.expired_units &&
    current.last_ledger_entry_id === item.actual_last_ledger_entry_id
  );
};

export const repairLeaveBalanceProjection = async (input: {
  runId: string;
  actorId: string;
  actionTime: Date;
  profile: EmployeeProfile;
  item: LeaveBalanceReconciliationItem;
}): Promise<"APPLIED" | "STALE"> =>
  db.runTransaction(async (transaction) => {
    const bucketRef = db
      .collection(BALANCES_COLLECTION)
      .doc(input.item.bucket_id);
    const snapshot = await transaction.get(bucketRef);
    const current = snapshot.exists ? withBucketId(snapshot) : null;
    if (!currentMatchesObservation(current, input.item)) return "STALE";

    const now = new Date();
    const base =
      current ??
      createEmptyLeaveBalanceBucket(input.profile, input.item.leave_year, now);
    const repaired: LeaveBalanceBucket = {
      ...base,
      ...input.item.expected,
      employee_user_id: input.profile.user_id,
      workplace_warehouse_id: input.profile.workplace_warehouse_id,
      last_ledger_entry_id: input.item.expected_last_ledger_entry_id,
      updated_at: now,
      action_time: input.actionTime,
      sync_time: now,
    };
    const auditId = createHash("sha256")
      .update(`${input.runId}:${input.item.bucket_id}`)
      .digest("hex");

    transaction.set(bucketRef, repaired);
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: BALANCES_COLLECTION,
      entity_id: repaired.id,
      warehouse_id: repaired.workplace_warehouse_id,
      action: current ? AuditAction.UPDATE : AuditAction.CREATE,
      user_id: input.actorId,
      user_name: "System",
      entity_name: repaired.id,
      action_time: input.actionTime,
      sync_time: now,
      old_value: current,
      new_value: repaired,
      ip_address: null,
      device_id: null,
      session_token: null,
      notes: `Phase 7 leave reconciliation repair ${input.runId}`,
    });
    return "APPLIED";
  });

export const recordLeaveReconciliationReport = async (
  report: LeaveBalanceReconciliationReport,
) => {
  const storedReport = {
    ...report,
    items: report.items
      .filter((item) => item.status !== "MATCHED")
      .slice(0, 100),
    truncated_items: Math.max(
      0,
      report.items.filter((item) => item.status !== "MATCHED").length - 100,
    ),
  };
  const runRef = db.collection(RUNS_COLLECTION).doc(report.run_id);
  const auditRef = db.collection("audit_logs").doc(report.run_id);
  const batch = db.batch();
  batch.create(runRef, storedReport);
  batch.create(auditRef, {
    id: auditRef.id,
    entity_type: RUNS_COLLECTION,
    entity_id: report.run_id,
    warehouse_id: null,
    action: AuditAction.CREATE,
    user_id: report.created_by,
    user_name: "System",
    entity_name: report.run_id,
    action_time: report.action_time,
    sync_time: report.sync_time,
    old_value: null,
    new_value: {
      run_id: report.run_id,
      mode: report.mode,
      status: report.status,
      mismatched_buckets: report.mismatched_buckets,
      invalid_ledger_buckets: report.invalid_ledger_buckets,
      repaired_buckets: report.repaired_buckets,
      stale_buckets: report.stale_buckets,
      failed_buckets: report.failed_buckets,
    },
    ip_address: null,
    device_id: null,
    session_token: null,
    notes: "Phase 7 leave balance reconciliation report",
  });
  await batch.commit();
};
