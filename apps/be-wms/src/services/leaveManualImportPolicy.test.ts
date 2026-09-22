import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaveDayPortion,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";

import { buildManualLeaveImportRows } from "./leaveManualImportPolicy.js";

test("manual leave history expands multiple selected dates into approved rows", () => {
  const rows = buildManualLeaveImportRows(
    {
      client_reference: "550e8400-e29b-41d4-a716-446655440000",
      employee_profile_id: "profile-1",
      request_type: LeaveRequestType.PAID_ANNUAL,
      days: [
        { date: "2026-08-31", portion: LeaveDayPortion.FULL_DAY },
        { date: "2026-09-03", portion: LeaveDayPortion.MORNING },
      ],
      reason: "  Nghỉ phép năm  ",
      action_time: new Date("2026-09-22T00:00:00.000Z"),
    },
    { employee_code: "nv001" },
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => ({
      employee: row.employee_code,
      date: row.normalized_payload.posting_date,
      units: row.normalized_payload.units,
      status: row.normalized_payload.request_status,
      reason: row.normalized_payload.reason,
    })),
    [
      {
        employee: "NV001",
        date: "2026-08-31",
        units: 1,
        status: LeaveRequestStatus.APPROVED,
        reason: "Nghỉ phép năm",
      },
      {
        employee: "NV001",
        date: "2026-09-03",
        units: 0.5,
        status: LeaveRequestStatus.APPROVED,
        reason: "Nghỉ phép năm",
      },
    ],
  );
  assert.notEqual(rows[0].source_reference, rows[1].source_reference);
});
