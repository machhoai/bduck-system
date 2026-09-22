import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaveDayPortion,
  LeaveRequestStatus,
  LeaveRequestType,
  type LeaveRequest,
} from "@bduck/shared-types";

import { mapAttendanceLeaveDays } from "./attendanceLeavePolicy.js";

const request = (status: LeaveRequestStatus): LeaveRequest => ({
  id: `request-${status}`,
  employee_profile_id: "profile-1",
  employee_user_id: "user-1",
  workplace_warehouse_id: "warehouse-1",
  request_type: LeaveRequestType.UNPAID,
  status,
  days: [
    { date: "2026-08-31", portion: LeaveDayPortion.FULL_DAY, units: 1 },
    { date: "2026-09-03", portion: LeaveDayPortion.MORNING, units: 0.5 },
  ],
  total_units: 1.5,
  reason: "Personal leave",
  cancellation_reason: null,
  balance_allocations: [],
  approval_attempt: 1,
  submitted_at: new Date(),
  completed_at: new Date(),
  created_by: "user-1",
  updated_by: "approver-1",
  source: "USER_REQUEST",
  source_reference: null,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  action_time: new Date(),
  sync_time: new Date(),
});

test("attendance calendar exposes submitted leave days in range", () => {
  const days = mapAttendanceLeaveDays(
    [
      request(LeaveRequestStatus.APPROVED),
      request(LeaveRequestStatus.PENDING_APPROVAL),
      request(LeaveRequestStatus.REJECTED),
    ],
    "2026-09-01",
    "2026-09-30",
  );

  assert.deepEqual(days, [
    {
      leave_request_id: "request-APPROVED",
      employee_profile_id: "profile-1",
      employee_user_id: "user-1",
      warehouse_id: "warehouse-1",
      attendance_date: "2026-09-03",
      request_type: LeaveRequestType.UNPAID,
      portion: LeaveDayPortion.MORNING,
      status: LeaveRequestStatus.APPROVED,
    },
    {
      leave_request_id: "request-PENDING_APPROVAL",
      employee_profile_id: "profile-1",
      employee_user_id: "user-1",
      warehouse_id: "warehouse-1",
      attendance_date: "2026-09-03",
      request_type: LeaveRequestType.UNPAID,
      portion: LeaveDayPortion.MORNING,
      status: LeaveRequestStatus.PENDING_APPROVAL,
    },
  ]);
});
