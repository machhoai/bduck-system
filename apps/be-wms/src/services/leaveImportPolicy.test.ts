import assert from "node:assert/strict";
import test from "node:test";
import {
  LeaveDayPortion,
  LeaveImportRecordType,
  type LeaveImportNormalizedPayload,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";
import {
  buildLeaveImportDelta,
  validateLeaveImportIdentity,
  validateLeaveImportPayload,
} from "./leaveImportPolicy.js";

const payload = (
  values: Partial<LeaveImportNormalizedPayload> = {},
): LeaveImportNormalizedPayload => ({
  posting_date: "2026-01-15",
  leave_year: 2026,
  units: 1,
  request_type: null,
  request_status: null,
  day_portion: null,
  reason: "Dữ liệu trước khi triển khai hệ thống",
  ...values,
});

test("validates safe source references and employee codes", () => {
  assert.equal(
    validateLeaveImportIdentity({
      source_reference: "LEGACY:2026-001",
      employee_code: "NV_001",
    }).length,
    0,
  );
  assert.equal(
    validateLeaveImportIdentity({
      source_reference: "$where",
      employee_code: "../NV001",
    }).length,
    2,
  );
});

test("historical requests require a completed status and matching portion", () => {
  assert.equal(
    validateLeaveImportPayload(
      LeaveImportRecordType.HISTORICAL_REQUEST,
      payload({
        request_type: LeaveRequestType.PAID_ANNUAL,
        request_status: LeaveRequestStatus.APPROVED,
        day_portion: LeaveDayPortion.MORNING,
        units: 0.5,
      }),
    ).length,
    0,
  );
  assert.ok(
    validateLeaveImportPayload(
      LeaveImportRecordType.HISTORICAL_REQUEST,
      payload({
        request_type: LeaveRequestType.PAID_ANNUAL,
        request_status: LeaveRequestStatus.PENDING_APPROVAL,
        day_portion: LeaveDayPortion.MORNING,
      }),
    ).length > 0,
  );
});

test("ledger rows reject request-only columns and non-half units", () => {
  assert.ok(
    validateLeaveImportPayload(
      LeaveImportRecordType.ACCRUAL,
      payload({
        units: 0.25,
        request_type: LeaveRequestType.PAID_ANNUAL,
      }),
    ).length >= 2,
  );
});

test("adjustments may be positive or negative but never zero", () => {
  assert.equal(
    validateLeaveImportPayload(
      LeaveImportRecordType.ADJUSTMENT,
      payload({ units: -1.5 }),
    ).length,
    0,
  );
  assert.ok(
    validateLeaveImportPayload(
      LeaveImportRecordType.ADJUSTMENT,
      payload({ units: 0 }),
    ).length > 0,
  );
});

test("paid approved historical requests consume available leave", () => {
  assert.deepEqual(
    buildLeaveImportDelta(
      LeaveImportRecordType.HISTORICAL_REQUEST,
      payload({
        request_type: LeaveRequestType.PAID_ANNUAL,
        request_status: LeaveRequestStatus.APPROVED,
        day_portion: LeaveDayPortion.FULL_DAY,
      }),
    ),
    {
      available_units: -1,
      held_units: 0,
      used_units: 1,
      pending_probation_units: 0,
      expired_units: 0,
    },
  );
});

test("unpaid or rejected history does not change the balance", () => {
  assert.equal(
    buildLeaveImportDelta(
      LeaveImportRecordType.HISTORICAL_REQUEST,
      payload({
        request_type: LeaveRequestType.UNPAID,
        request_status: LeaveRequestStatus.APPROVED,
        day_portion: LeaveDayPortion.FULL_DAY,
      }),
    ),
    null,
  );
});

test("accrual, usage, expiry and adjustment create auditable deltas", () => {
  assert.equal(
    buildLeaveImportDelta(LeaveImportRecordType.ACCRUAL, payload())
      ?.available_units,
    1,
  );
  assert.equal(
    buildLeaveImportDelta(LeaveImportRecordType.USED, payload())?.used_units,
    1,
  );
  assert.equal(
    buildLeaveImportDelta(LeaveImportRecordType.EXPIRED, payload())
      ?.expired_units,
    1,
  );
  assert.equal(
    buildLeaveImportDelta(
      LeaveImportRecordType.ADJUSTMENT,
      payload({ units: -0.5 }),
    )?.available_units,
    -0.5,
  );
});
