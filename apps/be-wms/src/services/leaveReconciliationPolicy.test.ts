import {
  type LeaveBalanceBucket,
  type LeaveLedgerEntry,
  LeaveLedgerEntryType,
} from "@bduck/shared-types";
import assert from "node:assert/strict";
import test from "node:test";
import { reconcileLeaveBalanceProjection } from "./leaveReconciliationPolicy.js";

const now = new Date("2026-07-24T00:00:00.000Z");

const entry = (id: string, availableUnits: number): LeaveLedgerEntry => ({
  id,
  employee_profile_id: "profile-1",
  employee_user_id: "user-1",
  workplace_warehouse_id: "office-1",
  leave_year: 2026,
  posting_date: "2026-07-15",
  entry_type: LeaveLedgerEntryType.MONTHLY_ACCRUAL,
  delta: {
    available_units: availableUnits,
    held_units: 0,
    used_units: 0,
    pending_probation_units: 0,
    expired_units: 0,
  },
  request_id: null,
  import_batch_id: null,
  source_reference: null,
  idempotency_key: id,
  reason: "TEST",
  created_by: "system",
  created_at: now,
  action_time: now,
  sync_time: now,
});

const bucket = (availableUnits: number): LeaveBalanceBucket => ({
  id: "profile-1_2026",
  employee_profile_id: "profile-1",
  employee_user_id: "user-1",
  workplace_warehouse_id: "office-1",
  leave_year: 2026,
  available_units: availableUnits,
  held_units: 0,
  used_units: 0,
  pending_probation_units: 0,
  expired_units: 0,
  last_ledger_entry_id: "ledger-1",
  is_deleted: false,
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});

test("reconciliation marks an equal ledger projection as matched", () => {
  const [result] = reconcileLeaveBalanceProjection({
    ledgerEntries: [entry("ledger-1", 1)],
    buckets: [bucket(1)],
  });
  assert.equal(result.status, "MATCHED");
  assert.deepEqual(result.differing_fields, []);
});

test("reconciliation identifies missing and mismatched buckets", () => {
  const [missing] = reconcileLeaveBalanceProjection({
    ledgerEntries: [entry("ledger-1", 1)],
    buckets: [],
  });
  assert.equal(missing.status, "MISSING_BUCKET");

  const [mismatched] = reconcileLeaveBalanceProjection({
    ledgerEntries: [entry("ledger-1", 1)],
    buckets: [bucket(0.5)],
  });
  assert.equal(mismatched.status, "MISMATCH");
  assert.deepEqual(mismatched.differing_fields, ["available_units"]);
});

test("reconciliation repairs a stale last-ledger pointer", () => {
  const [result] = reconcileLeaveBalanceProjection({
    ledgerEntries: [entry("ledger-2", 1)],
    buckets: [bucket(1)],
  });
  assert.equal(result.status, "MISMATCH");
  assert.deepEqual(result.differing_fields, ["last_ledger_entry_id"]);
});

test("reconciliation never repairs an invalid negative ledger projection", () => {
  const [result] = reconcileLeaveBalanceProjection({
    ledgerEntries: [entry("ledger-1", -0.5)],
    buckets: [bucket(0)],
  });
  assert.equal(result.status, "INVALID_LEDGER");
});
