import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
} from "@bduck/shared-types";

import {
  isEmployeeContractExpiringSoon,
  isEmployeeContractExpiryWarningDue,
  resolveAutomatedEmployeeContractStatus,
} from "./employeeContractAutomationPolicy.js";

const contract = (
  patch: Partial<EmployeeContract> = {},
): EmployeeContract =>
  ({
    id: "contract-1",
    employee_profile_id: "profile-1",
    employee_user_id: "user-1",
    workplace_warehouse_id: "facility-1",
    contract_number: "HD-001",
    contract_number_normalized: "HD-001",
    contract_type: EmployeeContractType.FIXED_TERM,
    start_date: "2026-01-01",
    end_date: "2026-08-31",
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
    created_by: "user-1",
    updated_by: "user-1",
    is_deleted: false,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    action_time: new Date("2026-01-01T00:00:00Z"),
    sync_time: new Date("2026-01-01T00:00:00Z"),
    ...patch,
  }) as EmployeeContract;

test("resolves UPCOMING, ACTIVE and EXPIRED at inclusive boundaries", () => {
  const item = contract();
  assert.equal(
    resolveAutomatedEmployeeContractStatus(item, "2025-12-31"),
    EmployeeContractStatus.UPCOMING,
  );
  assert.equal(
    resolveAutomatedEmployeeContractStatus(item, "2026-08-31"),
    EmployeeContractStatus.ACTIVE,
  );
  assert.equal(
    resolveAutomatedEmployeeContractStatus(item, "2026-09-01"),
    EmployeeContractStatus.EXPIRED,
  );
});

test("never overwrites cancelled or terminated lifecycle statuses", () => {
  assert.equal(
    resolveAutomatedEmployeeContractStatus(
      contract({ status: EmployeeContractStatus.CANCELLED }),
      "2026-09-01",
    ),
    EmployeeContractStatus.CANCELLED,
  );
  assert.equal(
    resolveAutomatedEmployeeContractStatus(
      contract({
        status: EmployeeContractStatus.TERMINATED,
        termination_date: "2026-03-01",
      }),
      "2026-09-01",
    ),
    EmployeeContractStatus.TERMINATED,
  );
});

test("warns from the 30-day threshold and catches up without warning late", () => {
  const item = contract();
  assert.equal(
    isEmployeeContractExpiryWarningDue(item, "2026-08-01"),
    true,
  );
  assert.equal(
    isEmployeeContractExpiryWarningDue(item, "2026-08-02"),
    true,
  );
  assert.equal(
    isEmployeeContractExpiryWarningDue(item, "2026-07-31"),
    false,
  );
  assert.equal(
    isEmployeeContractExpiryWarningDue(item, "2026-09-01"),
    false,
  );
});

test("excludes seasonal, indefinite and final contracts from warnings", () => {
  assert.equal(
    isEmployeeContractExpiryWarningDue(
      contract({ contract_type: EmployeeContractType.SEASONAL }),
      "2026-08-01",
    ),
    false,
  );
  assert.equal(
    isEmployeeContractExpiryWarningDue(
      contract({
        contract_type: EmployeeContractType.INDEFINITE,
        end_date: null,
      }),
      "2026-08-01",
    ),
    false,
  );
  assert.equal(
    isEmployeeContractExpiryWarningDue(
      contract({ status: EmployeeContractStatus.CANCELLED }),
      "2026-08-01",
    ),
    false,
  );
});

test("expiring-soon window includes today and day 30 only", () => {
  const item = contract();
  assert.equal(isEmployeeContractExpiringSoon(item, "2026-08-01"), true);
  assert.equal(isEmployeeContractExpiringSoon(item, "2026-08-31"), true);
  assert.equal(isEmployeeContractExpiringSoon(item, "2026-07-31"), false);
  assert.equal(isEmployeeContractExpiringSoon(item, "2026-09-01"), false);
});
