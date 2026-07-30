import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
} from "@bduck/shared-types";

import { emptyInitialContractForm } from "./employeeInitialContractDraft";
import { buildEmploymentContractPlan } from "./employmentTransitionContractPolicy";

const contract = (
  patch: Partial<EmployeeContract> = {},
): EmployeeContract =>
  ({
    id: "old-contract",
    employee_profile_id: "employee",
    employee_user_id: null,
    workplace_warehouse_id: "workplace",
    contract_number: "HD-OLD",
    contract_number_normalized: "HD-OLD",
    contract_type: EmployeeContractType.PROBATION,
    start_date: "2026-07-01",
    end_date: "2026-08-31",
    status: EmployeeContractStatus.ACTIVE,
    renewed_from_contract_id: null,
    root_contract_id: "old-contract",
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
    created_by: "actor",
    updated_by: "actor",
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
    action_time: new Date(),
    sync_time: new Date(),
    ...patch,
  }) as EmployeeContract;

const form = (startDate: string, endDate = "31-12-2026") => ({
  ...emptyInitialContractForm(),
  enabled: true,
  contract_number: "HD-OFFICIAL",
  start_date: startDate,
  end_date: endDate,
});

test("terminates an active contract before an immediate official contract", () => {
  const result = buildEmploymentContractPlan({
    form: form("30-07-2026"),
    contracts: [contract()],
    today: "2026-07-30",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.resolution.action, "TERMINATE");
  if (result.value.resolution.action === "TERMINATE") {
    assert.equal(result.value.resolution.contract.id, "old-contract");
    assert.equal(result.value.resolution.resolution_date, "2026-07-29");
  }
});

test("shortens a dated active contract for a future transition", () => {
  const result = buildEmploymentContractPlan({
    form: form("15-08-2026"),
    contracts: [contract()],
    today: "2026-07-30",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.resolution.action, "SHORTEN");
  if (result.value.resolution.action === "SHORTEN") {
    assert.equal(result.value.resolution.resolution_date, "2026-08-14");
  }
});

test("cancels an upcoming conflicting contract", () => {
  const result = buildEmploymentContractPlan({
    form: form("15-08-2026"),
    contracts: [
      contract({
        start_date: "2026-08-01",
        status: EmployeeContractStatus.UPCOMING,
      }),
    ],
    today: "2026-07-30",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.resolution.action, "CANCEL");
});

test("blocks a future transition that overlaps an indefinite contract", () => {
  const result = buildEmploymentContractPlan({
    form: form("15-08-2026"),
    contracts: [
      contract({
        contract_type: EmployeeContractType.INDEFINITE,
        end_date: null,
      }),
    ],
    today: "2026-07-30",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.resolution.action, "BLOCKED");
});

test("does not resolve a contract ending before the official contract", () => {
  const result = buildEmploymentContractPlan({
    form: form("15-08-2026"),
    contracts: [contract({ end_date: "2026-08-14" })],
    today: "2026-07-30",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.resolution.action, "NONE");
});
