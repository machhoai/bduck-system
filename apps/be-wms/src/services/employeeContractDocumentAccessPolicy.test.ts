import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
} from "@bduck/shared-types";

import { canReadEmployeeContractDocument } from "./employeeContractDocumentAccessPolicy.js";

const contract: EmployeeContract = {
  id: "contract-1",
  employee_profile_id: "profile-1",
  employee_user_id: "employee-1",
  workplace_warehouse_id: "facility-1",
  contract_number: "HD-001",
  contract_number_normalized: "HD-001",
  contract_type: EmployeeContractType.FIXED_TERM,
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  status: EmployeeContractStatus.ACTIVE,
  renewed_from_contract_id: null,
  root_contract_id: "contract-1",
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
  created_by: "hr-1",
  updated_by: "hr-1",
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  action_time: new Date(),
  sync_time: new Date(),
};

const permissions = (...allowed: string[]) => ({
  can: (action: string, facilityId: string) =>
    facilityId === "facility-1" && allowed.includes(action),
});

test("allows HR with document read permission", () => {
  assert.equal(
    canReadEmployeeContractDocument(
      contract,
      "hr-1",
      permissions("employees.contracts.documents.read"),
    ),
    true,
  );
});

test("allows self-read only for the employee bound to the contract", () => {
  const selfPermission = permissions("employees.contracts.self.read");
  assert.equal(
    canReadEmployeeContractDocument(contract, "employee-1", selfPermission),
    true,
  );
  assert.equal(
    canReadEmployeeContractDocument(contract, "employee-2", selfPermission),
    false,
  );
});

test("does not substitute generic contract read for PDF read", () => {
  assert.equal(
    canReadEmployeeContractDocument(
      contract,
      "hr-1",
      permissions("employees.contracts.read"),
    ),
    false,
  );
});
