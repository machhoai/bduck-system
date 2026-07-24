import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LeaveBalanceBucket, LeaveLedgerDelta } from "@bduck/shared-types";
import {
  applyLeaveDelta,
  buildLeaveBalanceSummary,
  createLeaveLedgerDocumentId,
  getLeaveEntitlementUnits,
  isLeaveYearExpired,
} from "./leaveBalancePolicy.js";

const bucket = (overrides: Partial<LeaveBalanceBucket> = {}) =>
  ({
    id: "employee-1_2026",
    employee_profile_id: "employee-1",
    employee_user_id: "user-1",
    workplace_warehouse_id: "warehouse-1",
    leave_year: 2026,
    available_units: 2,
    held_units: 1,
    used_units: 3,
    pending_probation_units: 0,
    expired_units: 0,
    last_ledger_entry_id: null,
    is_deleted: false,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    action_time: new Date("2026-01-01T00:00:00Z"),
    sync_time: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }) satisfies LeaveBalanceBucket;

describe("leave balance projection policy", () => {
  it("moves units between buckets without changing entitlement", () => {
    const delta: LeaveLedgerDelta = {
      available_units: 2,
      held_units: 0,
      used_units: 0,
      pending_probation_units: -2,
      expired_units: 0,
    };
    const before = bucket({ pending_probation_units: 2 });
    const after = applyLeaveDelta(before, delta);

    assert.equal(after.available_units, 4);
    assert.equal(after.pending_probation_units, 0);
    assert.equal(
      getLeaveEntitlementUnits(after),
      getLeaveEntitlementUnits(before),
    );
  });

  it("rejects a delta that would make any projected balance negative", () => {
    assert.throws(
      () =>
        applyLeaveDelta(bucket(), {
          available_units: -3,
          held_units: 0,
          used_units: 0,
          pending_probation_units: 0,
          expired_units: 3,
        }),
      /INVALID_LEAVE_BALANCE:available_units/,
    );
  });

  it("expires a leave year only after March 31 of the following year", () => {
    assert.equal(isLeaveYearExpired(2026, "2027-03-31"), false);
    assert.equal(isLeaveYearExpired(2026, "2027-04-01"), true);
  });

  it("creates a stable and collision-resistant document id from idempotency", () => {
    const first = createLeaveLedgerDocumentId(
      "leave-accrual:employee-1:2026-07-15",
    );
    const retry = createLeaveLedgerDocumentId(
      "leave-accrual:employee-1:2026-07-15",
    );
    const otherMonth = createLeaveLedgerDocumentId(
      "leave-accrual:employee-1:2026-08-15",
    );

    assert.equal(first, retry);
    assert.notEqual(first, otherMonth);
    assert.equal(first.length, 64);
  });

  it("summarizes all yearly buckets and keeps newest year first", () => {
    const summary = buildLeaveBalanceSummary({
      employee_profile_id: "employee-1",
      as_of_date: "2027-02-01",
      buckets: [
        bucket({ id: "employee-1_2026", leave_year: 2026 }),
        bucket({
          id: "employee-1_2027",
          leave_year: 2027,
          available_units: 1,
          held_units: 0,
          used_units: 0,
        }),
      ],
      recent_entries: [],
    });

    assert.equal(summary.available_units, 3);
    assert.equal(summary.held_units, 1);
    assert.equal(summary.used_units, 3);
    assert.deepEqual(
      summary.buckets.map((item) => item.leave_year),
      [2027, 2026],
    );
  });
});
