import assert from "node:assert/strict";
import test from "node:test";
import {
  EmployeeContractImportLifecycleState,
  EmployeeContractStatus,
  EmployeeContractType,
  EmployeeProfileStatus,
} from "@bduck/shared-types";

import { doEmployeeContractPeriodsOverlap } from "./employeeContractPolicy.js";
import { buildImportedEmployeeContract } from "./employeeContractImportContractFactory.js";

const profile = {
  id: "profile-1",
  user_id: "user-1",
  employee_code: "NV001",
  full_name: "Nguyễn Văn A",
  email: null,
  phone: null,
  job_title: null,
  department: null,
  workplace_warehouse_id: "warehouse-1",
  status: EmployeeProfileStatus.ACTIVE,
  notes: null,
  is_deleted: false,
  created_at: new Date("2024-01-01T00:00:00.000Z"),
  updated_at: new Date("2024-01-01T00:00:00.000Z"),
};

const build = (
  id: string,
  state: EmployeeContractImportLifecycleState | null,
  lifecycleDate: string | null,
) =>
  buildImportedEmployeeContract({
    id,
    profile,
    actor_id: "hr-1",
    action_time: new Date("2026-01-01T00:00:00.000Z"),
    sync_time: new Date("2026-01-01T00:00:00.000Z"),
    payload: {
      employee_code: "NV001",
      contract_number: id,
      contract_type: EmployeeContractType.FIXED_TERM,
      start_date: id === "next" ? "2024-07-01" : "2024-01-01",
      end_date: id === "next" ? "2025-06-30" : "2024-12-31",
      lifecycle_state: state,
      lifecycle_date: lifecycleDate,
      lifecycle_reason: state ? "Dữ liệu lịch sử" : null,
      pdf_file_name: null,
      notes: null,
    },
  });

test("early termination shortens the overlap period for historical imports", () => {
  const terminated = build(
    "old",
    EmployeeContractImportLifecycleState.TERMINATED,
    "2024-06-30",
  );
  const next = build("next", null, null);
  assert.equal(terminated.status, EmployeeContractStatus.TERMINATED);
  assert.equal(doEmployeeContractPeriodsOverlap(terminated, next), false);
});

test("cancelled historical contracts do not block another contract", () => {
  const cancelled = build(
    "cancelled",
    EmployeeContractImportLifecycleState.CANCELLED,
    "2023-12-31",
  );
  const next = build("next", null, null);
  assert.equal(cancelled.status, EmployeeContractStatus.CANCELLED);
  assert.equal(doEmployeeContractPeriodsOverlap(cancelled, next), false);
});
