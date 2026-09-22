import assert from "node:assert/strict";
import test from "node:test";
import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
  type AttendanceLateReport,
  type EmployeeProfile,
} from "@bduck/shared-types";
import {
  filterAttendanceEligibleProfiles,
  getLateReportArrivalTime,
} from "./attendance";

const employeeProfile = (
  overrides: Partial<EmployeeProfile> = {},
): EmployeeProfile => ({
  id: "profile-1",
  user_id: "user-1",
  employee_code: "NV001",
  full_name: "Nguyen Van A",
  email: null,
  phone: null,
  job_title: null,
  department: null,
  workplace_warehouse_id: "warehouse-1",
  status: EmployeeProfileStatus.ACTIVE,
  employment_status: EmployeeEmploymentStatus.OFFICIAL,
  probation_start_date: null,
  probation_end_date: null,
  official_start_date: "2026-01-01",
  resignation_date: null,
  notes: null,
  is_deleted: false,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

test("uses the estimated arrival time for new late reports", () => {
  assert.equal(
    getLateReportArrivalTime({
      estimated_arrival_time: "09:15",
      expected_arrival_time: null,
    }),
    "09:15",
  );
});

test("falls back to the legacy expected arrival time", () => {
  assert.equal(
    getLateReportArrivalTime({
      estimated_arrival_time: null,
      expected_arrival_time: "09:30",
    }),
    "09:30",
  );
});

test("prefers estimated arrival time when both legacy fields exist", () => {
  const report = {
    estimated_arrival_time: "09:45",
    expected_arrival_time: "09:30",
  } satisfies Pick<
    AttendanceLateReport,
    "estimated_arrival_time" | "expected_arrival_time"
  >;

  assert.equal(getLateReportArrivalTime(report), "09:45");
});

test("attendance configuration hides employees who have resigned", () => {
  const activeProfile = employeeProfile();
  const resignedProfile = employeeProfile({
    id: "profile-2",
    user_id: "user-2",
    employee_code: "NV002",
    status: EmployeeProfileStatus.INACTIVE,
    employment_status: EmployeeEmploymentStatus.RESIGNED,
    resignation_date: "2026-09-01",
  });

  assert.deepEqual(
    filterAttendanceEligibleProfiles(
      [activeProfile, resignedProfile],
      "2026-09-22",
    ).map((profile) => profile.id),
    [activeProfile.id],
  );
});
