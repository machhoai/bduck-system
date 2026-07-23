import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
  type EmployeeProfile,
} from "@bduck/shared-types";
import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionEmploymentStatus,
  employmentDatePatchForTransition,
  getVietnamLocalDate,
  validateEmployeeEmploymentProfile,
} from "./employeeEmploymentPolicy.js";
import { planEmployeeEmploymentStatusBackfill } from "../scripts/employeeEmploymentBackfillPlanner.js";

const profile = (values: Partial<EmployeeProfile> = {}): EmployeeProfile => ({
  id: "employee-1",
  user_id: "user-1",
  employee_code: "NV001",
  full_name: "Nhân viên 1",
  email: null,
  phone: null,
  job_title: null,
  department: null,
  workplace_warehouse_id: "warehouse-1",
  status: EmployeeProfileStatus.ACTIVE,
  employment_status: EmployeeEmploymentStatus.UNSPECIFIED,
  notes: null,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  ...values,
});

test("allows only forward employment lifecycle transitions", () => {
  assert.equal(
    canTransitionEmploymentStatus(
      EmployeeEmploymentStatus.PROBATION,
      EmployeeEmploymentStatus.OFFICIAL,
    ),
    true,
  );
  assert.equal(
    canTransitionEmploymentStatus(
      EmployeeEmploymentStatus.OFFICIAL,
      EmployeeEmploymentStatus.PROBATION,
    ),
    false,
  );
  assert.equal(
    canTransitionEmploymentStatus(
      EmployeeEmploymentStatus.RESIGNED,
      EmployeeEmploymentStatus.OFFICIAL,
    ),
    false,
  );
});

test("requires the date associated with each employment status", () => {
  const probationIssues = validateEmployeeEmploymentProfile(
    profile({ employment_status: EmployeeEmploymentStatus.PROBATION }),
  );
  assert.equal(probationIssues[0]?.field, "probation_start_date");

  const officialIssues = validateEmployeeEmploymentProfile(
    profile({ employment_status: EmployeeEmploymentStatus.OFFICIAL }),
  );
  assert.equal(officialIssues[0]?.field, "official_start_date");

  const resignedIssues = validateEmployeeEmploymentProfile(
    profile({ employment_status: EmployeeEmploymentStatus.RESIGNED }),
  );
  assert.equal(resignedIssues[0]?.field, "resignation_date");
});

test("rejects chronologically inconsistent employment dates", () => {
  const issues = validateEmployeeEmploymentProfile(
    profile({
      employment_status: EmployeeEmploymentStatus.OFFICIAL,
      probation_start_date: "2026-01-10",
      probation_end_date: "2026-03-10",
      official_start_date: "2026-03-09",
    }),
  );
  assert.equal(issues[0]?.field, "official_start_date");
  assert.ok(issues[0]?.messages.vi);
  assert.ok(issues[0]?.messages.zh);
});

test("requires probation end date before a probation employee becomes official", () => {
  const issues = validateEmployeeEmploymentProfile(
    profile({
      employment_status: EmployeeEmploymentStatus.OFFICIAL,
      probation_start_date: "2026-01-10",
      official_start_date: "2026-03-10",
    }),
  );
  assert.equal(issues[0]?.field, "probation_end_date");
});

test("transition patch uses the user-selected effective date", () => {
  assert.deepEqual(
    employmentDatePatchForTransition(
      EmployeeEmploymentStatus.OFFICIAL,
      "2026-03-15",
      "2026-03-14",
    ),
    {
      employment_status: EmployeeEmploymentStatus.OFFICIAL,
      official_start_date: "2026-03-15",
      probation_end_date: "2026-03-14",
    },
  );
  assert.deepEqual(
    employmentDatePatchForTransition(
      EmployeeEmploymentStatus.RESIGNED,
      "2026-08-20",
    ),
    {
      employment_status: EmployeeEmploymentStatus.RESIGNED,
      resignation_date: "2026-08-20",
      status: EmployeeProfileStatus.INACTIVE,
    },
  );
});

test("Vietnam local date is stable around the UTC day boundary", () => {
  assert.equal(
    getVietnamLocalDate(new Date("2026-07-22T18:00:00.000Z")),
    "2026-07-23",
  );
});

test("backfill only targets legacy records without employment_status", () => {
  assert.deepEqual(
    planEmployeeEmploymentStatusBackfill([
      { id: "legacy" },
      {
        id: "official",
        employment_status: EmployeeEmploymentStatus.OFFICIAL,
      },
    ]),
    [
      {
        id: "legacy",
        employment_status: EmployeeEmploymentStatus.UNSPECIFIED,
      },
    ],
  );
});
