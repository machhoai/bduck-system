import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
} from "@bduck/shared-types";

import { reconcileEmployeeContracts } from "./employeeContractReconciliationPolicy.js";

const contract = (
  id: string,
  patch: Partial<EmployeeContract> = {},
): EmployeeContract =>
  ({
    id,
    employee_profile_id: "profile-1",
    employee_user_id: null,
    workplace_warehouse_id: "facility-1",
    contract_number: `HD-${id}`,
    contract_number_normalized: `HD-${id}`.toUpperCase(),
    contract_type: EmployeeContractType.FIXED_TERM,
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    status: EmployeeContractStatus.EXPIRED,
    renewed_from_contract_id: null,
    root_contract_id: id,
    renewal_sequence: 0,
    termination_date: null,
    termination_reason: null,
    terminated_by: null,
    terminated_at: null,
    cancellation_reason: null,
    cancelled_by: null,
    cancelled_at: null,
    notes: null,
    revision: 1,
    created_by: "test",
    updated_by: "test",
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
    action_time: new Date(),
    sync_time: new Date(),
    ...patch,
  }) as EmployeeContract;

test("reconciliation accepts consistent numbers, periods, status and locks", () => {
  const item = contract("1");
  const report = reconcileEmployeeContracts(
    [item],
    [
      {
        id: "lock-1",
        contract_number_normalized: item.contract_number_normalized,
        contract_id: item.id,
        is_deleted: false,
      },
    ],
    "2026-07-29",
  );
  assert.equal(report.issues.length, 0);
});

test("reconciliation reports duplicates and overlapping periods as blockers", () => {
  const left = contract("1", { contract_number: "HD-DUP" });
  const right = contract("2", {
    contract_number: "HD-DUP",
    contract_number_normalized: "HD-DUP",
    start_date: "2026-06-01",
    end_date: "2026-12-31",
  });
  const report = reconcileEmployeeContracts(
    [left, right],
    [],
    "2026-07-29",
  );
  assert.equal(report.duplicate_numbers, 1);
  assert.equal(report.overlaps, 1);
  assert.ok(report.blocking_issues >= 2);
});

test("reconciliation marks status, normalization and missing locks repairable", () => {
  const item = contract("1", {
    contract_number: " hd-legacy ",
    contract_number_normalized: "wrong",
    status: EmployeeContractStatus.ACTIVE,
  });
  const report = reconcileEmployeeContracts(
    [item],
    [],
    "2026-07-29",
  );
  assert.equal(report.blocking_issues, 0);
  assert.ok(report.projection_drifts >= 2);
  assert.deepEqual(report.repair_contract_ids, [item.id]);
});
