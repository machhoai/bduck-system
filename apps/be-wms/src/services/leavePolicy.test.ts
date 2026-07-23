import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LeaveDayPortion,
  PERMISSION_GROUPS,
  PERMISSION_REGISTRY,
  type LeaveRequestDaySelection,
} from "@bduck/shared-types";
import {
  classifyMonthlyLeaveAccrual,
  evaluateLeaveDateSelection,
  getLeaveCarryoverExpiryDate,
} from "./leavePolicy.js";

const fullDay = (date: string) => ({
  date,
  portion: LeaveDayPortion.FULL_DAY,
});

describe("leave date selection policy", () => {
  it("returns localized validation when no dates are selected", () => {
    const result = evaluateLeaveDateSelection([]);

    assert.equal(result.valid, false);
    assert.equal(result.issues[0]?.code, "LEAVE_DATES_REQUIRED");
    assert.ok(result.issues[0]?.messages.vi);
    assert.ok(result.issues[0]?.messages.zh);
  });

  it("accepts one two-day calendar gap", () => {
    const result = evaluateLeaveDateSelection([
      fullDay("2026-05-22"),
      fullDay("2026-05-18"),
      fullDay("2026-05-20"),
      fullDay("2026-05-19"),
    ]);

    assert.equal(result.valid, true);
    assert.deepEqual(
      result.normalized_days.map((day) => day.date),
      ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-22"],
    );
    assert.equal(result.total_units, 4);
  });

  it("rejects a calendar gap wider than two days", () => {
    const result = evaluateLeaveDateSelection([
      fullDay("2026-08-18"),
      fullDay("2026-08-19"),
      fullDay("2026-08-20"),
      fullDay("2026-08-24"),
    ]);

    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some((issue) => issue.code === "LEAVE_DATE_GAP_TOO_WIDE"),
    );
  });

  it("rejects more than one gap occurrence", () => {
    const result = evaluateLeaveDateSelection([
      fullDay("2026-05-18"),
      fullDay("2026-05-20"),
      fullDay("2026-05-22"),
    ]);

    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some((issue) => issue.code === "LEAVE_DATE_TOO_MANY_GAPS"),
    );
  });

  it("rejects duplicate, weekend, holiday, and invalid dates", () => {
    const result = evaluateLeaveDateSelection(
      [
        fullDay("2026-05-20"),
        fullDay("2026-05-20"),
        fullDay("2026-05-23"),
        fullDay("2026-02-30"),
      ],
      { holiday_dates: new Set(["2026-05-20"]) },
    );

    assert.equal(result.valid, false);
    assert.deepEqual(
      new Set(result.issues.map((issue) => issue.code)),
      new Set([
        "LEAVE_DATE_HOLIDAY",
        "LEAVE_DATE_DUPLICATE",
        "LEAVE_DATE_WEEKEND",
        "LEAVE_DATE_INVALID",
        "LEAVE_DATE_GAP_TOO_WIDE",
      ]),
    );
    result.issues.forEach((issue) => {
      assert.ok(issue.messages.vi.length > 0);
      assert.ok(issue.messages.zh.length > 0);
    });
  });

  it("calculates half-day units without trusting client totals", () => {
    const result = evaluateLeaveDateSelection([
      { date: "2026-05-18", portion: LeaveDayPortion.MORNING },
      { date: "2026-05-19", portion: LeaveDayPortion.AFTERNOON },
      fullDay("2026-05-20"),
    ]);

    assert.equal(result.valid, true);
    assert.equal(result.total_units, 2);
    assert.deepEqual(
      result.normalized_days.map((day) => day.units),
      [0.5, 0.5, 1],
    );
  });

  it("rejects an unknown day portion received at runtime", () => {
    const result = evaluateLeaveDateSelection([
      {
        date: "2026-05-18",
        portion: "NIGHT",
      } as unknown as LeaveRequestDaySelection,
    ]);

    assert.equal(result.valid, false);
    assert.equal(result.issues[0]?.code, "LEAVE_DAY_PORTION_INVALID");
    assert.ok(result.issues[0]?.messages.vi);
    assert.ok(result.issues[0]?.messages.zh);
  });
});

describe("leave permission i18n contract", () => {
  it("provides Vietnamese and Chinese copy for every HR leave permission", () => {
    const leaveGroup = PERMISSION_GROUPS.find((group) => group.id === "leave");
    assert.ok(leaveGroup?.label.vi);
    assert.ok(leaveGroup?.label.zh);

    const definitions = PERMISSION_REGISTRY.filter(
      (permission) =>
        permission.group === "leave" ||
        permission.key === "employees.employment.manage",
    );
    assert.equal(definitions.length, 10);

    definitions.forEach((permission) => {
      assert.ok(permission.label.vi);
      assert.ok(permission.label.zh);
      assert.ok(permission.description.vi);
      assert.ok(permission.description.zh);
    });
  });
});

describe("monthly leave accrual policy", () => {
  it("posts the current month when probation starts on or before the cutoff", () => {
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-09-15",
        probation_start_date: "2026-09-10",
        official_start_date: null,
        resignation_date: null,
      }),
      "PENDING_PROBATION",
    );
  });

  it("posts probation accrual on the next monthly cutoff after a late start", () => {
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-09-15",
        probation_start_date: "2026-09-20",
        official_start_date: null,
        resignation_date: null,
      }),
      "NOT_EMPLOYED",
    );
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-10-15",
        probation_start_date: "2026-09-20",
        official_start_date: null,
        resignation_date: null,
      }),
      "PENDING_PROBATION",
    );
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-11-15",
        probation_start_date: "2026-09-20",
        official_start_date: null,
        resignation_date: null,
      }),
      "PENDING_PROBATION",
    );
  });

  it("posts available accrual only after the chosen official effective date", () => {
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-11-15",
        probation_start_date: "2026-09-20",
        official_start_date: "2026-11-10",
        resignation_date: null,
      }),
      "AVAILABLE",
    );
  });

  it("does not accrue on a non-cutoff day or on resignation date", () => {
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-11-14",
        probation_start_date: "2026-09-20",
        official_start_date: "2026-11-10",
        resignation_date: null,
      }),
      "NOT_DUE",
    );
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-11-15",
        probation_start_date: "2026-09-20",
        official_start_date: "2026-11-10",
        resignation_date: "2026-11-15",
      }),
      "NOT_EMPLOYED",
    );
  });

  it("rejects malformed employment dates instead of silently accruing", () => {
    assert.equal(
      classifyMonthlyLeaveAccrual({
        posting_date: "2026-11-15",
        probation_start_date: "2026-02-30",
        official_start_date: null,
        resignation_date: null,
      }),
      "INVALID_DATE",
    );
  });

  it("calculates the carryover expiry date", () => {
    assert.equal(getLeaveCarryoverExpiryDate(2026), "2027-03-31");
  });
});
