import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LeaveDayPortion,
  type LeaveBalanceBucket,
  type LeaveRequestDay,
} from "@bduck/shared-types";
import { allocatePaidLeaveUnits } from "./leaveRequestPolicy.js";

const bucket = (
  leaveYear: number,
  availableUnits: number,
): LeaveBalanceBucket => ({
  id: `employee_${leaveYear}`,
  employee_profile_id: "employee",
  employee_user_id: "user",
  workplace_warehouse_id: "warehouse",
  leave_year: leaveYear,
  available_units: availableUnits,
  held_units: 0,
  used_units: 0,
  pending_probation_units: 0,
  expired_units: 0,
  last_ledger_entry_id: null,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  action_time: new Date(),
  sync_time: new Date(),
});

const day = (date: string, units: 0.5 | 1 = 1): LeaveRequestDay => ({
  date,
  portion:
    units === 1 ? LeaveDayPortion.FULL_DAY : LeaveDayPortion.MORNING,
  units,
});

describe("paid leave allocation", () => {
  it("uses the oldest valid balance first", () => {
    const result = allocatePaidLeaveUnits(
      [day("2027-03-30"), day("2027-03-31", 0.5)],
      [bucket(2027, 4), bucket(2026, 1)],
    );
    assert.deepEqual(result.allocations, [
      { leave_year: 2026, units: 1 },
      { leave_year: 2027, units: 0.5 },
    ]);
    assert.equal(result.insufficient_units, 0);
  });

  it("does not spend carryover on leave after March 31", () => {
    const result = allocatePaidLeaveUnits(
      [day("2027-04-01")],
      [bucket(2026, 5), bucket(2027, 0.5)],
    );
    assert.deepEqual(result.allocations, [
      { leave_year: 2027, units: 0.5 },
    ]);
    assert.equal(result.insufficient_units, 0.5);
  });

  it("allocates per selected day across the expiry boundary", () => {
    const result = allocatePaidLeaveUnits(
      [day("2027-03-31"), day("2027-04-01")],
      [bucket(2026, 1), bucket(2027, 1)],
    );
    assert.deepEqual(result.allocations, [
      { leave_year: 2026, units: 1 },
      { leave_year: 2027, units: 1 },
    ]);
    assert.equal(result.insufficient_units, 0);
  });
});
