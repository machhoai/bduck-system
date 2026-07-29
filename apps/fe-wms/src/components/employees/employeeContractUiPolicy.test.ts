import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
} from "@bduck/shared-types";

import {
  canCancelContract,
  canRenewContract,
  canTerminateContract,
  resolveContractUiStatus,
} from "./employeeContractUiPolicy.js";

const contract = (
  overrides: Partial<EmployeeContract> = {},
): EmployeeContract =>
  ({
    id: "contract",
    employee_profile_id: "profile",
    employee_user_id: null,
    workplace_warehouse_id: "workplace",
    contract_number: "HD-001",
    contract_number_normalized: "HD-001",
    contract_type: EmployeeContractType.FIXED_TERM,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    status: EmployeeContractStatus.ACTIVE,
    renewed_from_contract_id: null,
    root_contract_id: "contract",
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
    deleted_at: null,
    deleted_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as EmployeeContract;

test("derives time-sensitive statuses without waiting for a write", () => {
  assert.equal(
    resolveContractUiStatus(contract(), "2025-12-31"),
    EmployeeContractStatus.UPCOMING,
  );
  assert.equal(
    resolveContractUiStatus(contract(), "2027-01-01"),
    EmployeeContractStatus.EXPIRED,
  );
});

test("allows only matching lifecycle actions", () => {
  assert.equal(canCancelContract(contract(), "2025-12-31"), true);
  assert.equal(canTerminateContract(contract(), "2026-07-29"), true);
  assert.equal(
    canRenewContract(
      contract({ contract_type: EmployeeContractType.INDEFINITE }),
      "2026-07-29",
    ),
    false,
  );
  assert.equal(
    canRenewContract(
      contract({ contract_type: EmployeeContractType.SEASONAL }),
      "2026-07-29",
    ),
    true,
  );
});
