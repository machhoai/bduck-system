import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
} from "@bduck/shared-types";

import {
  validateEmployeeContractCancellation,
  validateEmployeeContractRenewal,
  validateEmployeeContractTermination,
} from "./employeeContractLifecyclePolicy.js";
import {
  doEmployeeContractPeriodsOverlap,
  normalizeEmployeeContractNumber,
  resolveEmployeeContractStatus,
  validateEmployeeContractDraft,
} from "./employeeContractPolicy.js";

const contract = (
  values: Partial<EmployeeContract> = {},
): EmployeeContract => ({
  id: "contract-1",
  employee_profile_id: "employee-1",
  employee_user_id: "user-1",
  workplace_warehouse_id: "warehouse-1",
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
  created_by: "admin-1",
  updated_by: "admin-1",
  action_time: new Date("2026-01-01T00:00:00.000Z"),
  sync_time: new Date("2026-01-01T00:00:01.000Z"),
  is_deleted: false,
  created_at: new Date("2026-01-01T00:00:01.000Z"),
  updated_at: new Date("2026-01-01T00:00:01.000Z"),
  ...values,
});

const draft = {
  contract_number: "HD-002",
  contract_type: EmployeeContractType.FIXED_TERM,
  start_date: "2027-01-01",
  end_date: "2027-12-31",
} as const;

const issueCodes = (issues: ReturnType<typeof validateEmployeeContractDraft>) =>
  issues.map((item) => item.code);

test("normalizes contract numbers deterministically", () => {
  assert.equal(
    normalizeEmployeeContractNumber("  hđ  ２０２６-01  "),
    "HĐ 2026-01",
  );
});

test("validates number uniqueness even when an old contract is soft deleted", () => {
  const issues = validateEmployeeContractDraft(
    "employee-1",
    { ...draft, contract_number: " hd-001 " },
    [contract({ is_deleted: true })],
  );
  assert.ok(issueCodes(issues).includes("CONTRACT_NUMBER_DUPLICATE"));

  const unsafe = validateEmployeeContractDraft(
    "employee-1",
    { ...draft, contract_number: "$where" },
    [],
  );
  assert.ok(issueCodes(unsafe).includes("CONTRACT_NUMBER_INVALID"));
});

test("enforces end-date rules for every contract type", () => {
  const missingEnd = validateEmployeeContractDraft(
    "employee-1",
    {
      ...draft,
      contract_type: EmployeeContractType.PROBATION,
      end_date: null,
    },
    [],
  );
  assert.ok(issueCodes(missingEnd).includes("CONTRACT_END_DATE_REQUIRED"));

  const indefiniteEnd = validateEmployeeContractDraft(
    "employee-1",
    {
      ...draft,
      contract_type: EmployeeContractType.INDEFINITE,
    },
    [],
  );
  assert.ok(issueCodes(indefiniteEnd).includes("CONTRACT_END_DATE_FORBIDDEN"));

  const invalidOrder = validateEmployeeContractDraft(
    "employee-1",
    { ...draft, start_date: "2027-02-01", end_date: "2027-01-31" },
    [],
  );
  assert.ok(issueCodes(invalidOrder).includes("CONTRACT_DATE_ORDER_INVALID"));
});

test("treats contract interval boundaries as inclusive", () => {
  const existing = contract();
  assert.equal(
    doEmployeeContractPeriodsOverlap(
      contract({
        id: "same-day",
        start_date: "2026-12-31",
        end_date: "2027-06-30",
      }),
      existing,
    ),
    true,
  );
  assert.equal(
    doEmployeeContractPeriodsOverlap(
      contract({
        id: "next-day",
        start_date: "2027-01-01",
        end_date: "2027-06-30",
      }),
      existing,
    ),
    false,
  );
});

test("uses early termination as the effective end and ignores cancelled periods", () => {
  const terminated = contract({ termination_date: "2026-06-30" });
  const next = contract({
    id: "contract-2",
    start_date: "2026-07-01",
    end_date: "2026-12-31",
  });
  assert.equal(doEmployeeContractPeriodsOverlap(terminated, next), false);
  assert.equal(
    doEmployeeContractPeriodsOverlap(
      contract({ status: EmployeeContractStatus.CANCELLED }),
      contract({ id: "replacement" }),
    ),
    false,
  );
});

test("draft validation reports the conflicting contract", () => {
  const issues = validateEmployeeContractDraft(
    "employee-1",
    {
      ...draft,
      start_date: "2026-06-01",
      end_date: "2027-05-31",
    },
    [contract()],
  );
  const overlap = issues.find(
    (item) => item.code === "CONTRACT_PERIOD_OVERLAP",
  );
  assert.equal(overlap?.conflicting_contract_id, "contract-1");

  assert.deepEqual(
    validateEmployeeContractDraft("employee-2", draft, [contract()]),
    [],
  );
});

test("allows a fixed-term renewal only on the next day with the same type", () => {
  const source = contract();
  assert.deepEqual(
    validateEmployeeContractRenewal(source, draft, [source]),
    [],
  );

  const wrongStart = validateEmployeeContractRenewal(
    source,
    { ...draft, start_date: "2027-01-02" },
    [source],
  );
  assert.ok(
    wrongStart.some((item) => item.code === "CONTRACT_RENEWAL_START_MISMATCH"),
  );

  const wrongType = validateEmployeeContractRenewal(
    source,
    { ...draft, contract_type: EmployeeContractType.SEASONAL },
    [source],
  );
  assert.ok(
    wrongType.some((item) => item.code === "CONTRACT_RENEWAL_TYPE_MISMATCH"),
  );
});

test("rejects probation renewal and a second renewal from the same source", () => {
  const probation = contract({
    contract_type: EmployeeContractType.PROBATION,
  });
  assert.ok(
    validateEmployeeContractRenewal(probation, draft, [probation]).some(
      (item) => item.code === "CONTRACT_RENEWAL_NOT_ALLOWED",
    ),
  );

  const source = contract();
  const successor = contract({
    id: "contract-2",
    contract_number: "HD-002",
    contract_number_normalized: "HD-002",
    start_date: "2027-01-01",
    end_date: "2027-12-31",
    renewed_from_contract_id: source.id,
  });
  assert.ok(
    validateEmployeeContractRenewal(source, draft, [source, successor]).some(
      (item) => item.code === "CONTRACT_RENEWAL_ALREADY_EXISTS",
    ),
  );
});

test("cancels only an upcoming contract with a safe reason", () => {
  const upcoming = contract({
    start_date: "2026-08-01",
    status: EmployeeContractStatus.UPCOMING,
  });
  assert.deepEqual(
    validateEmployeeContractCancellation(
      upcoming,
      "Hai bên thống nhất hủy",
      "2026-07-29",
    ),
    [],
  );
  assert.ok(
    validateEmployeeContractCancellation(contract(), "Hủy", "2026-07-29").some(
      (item) => item.code === "CONTRACT_CANCELLATION_NOT_ALLOWED",
    ),
  );
  assert.ok(
    validateEmployeeContractCancellation(upcoming, "$where", "2026-07-29").some(
      (item) => item.code === "CONTRACT_REASON_REQUIRED",
    ),
  );
});

test("terminates only an active contract on a valid non-future date", () => {
  assert.deepEqual(
    validateEmployeeContractTermination(
      contract(),
      "2026-07-15",
      "Hai bên thống nhất",
      "2026-07-29",
    ),
    [],
  );
  assert.ok(
    validateEmployeeContractTermination(
      contract(),
      "2026-08-01",
      "Hai bên thống nhất",
      "2026-07-29",
    ).some(
      (item) =>
        item.code === "CONTRACT_DATE_INVALID" &&
        item.field === "termination_date",
    ),
  );
  assert.ok(
    validateEmployeeContractTermination(
      contract({ start_date: "2026-08-01" }),
      "2026-08-01",
      "Hai bên thống nhất",
      "2026-07-29",
    ).some((item) => item.code === "CONTRACT_TERMINATION_NOT_ALLOWED"),
  );
});

test("derives lifecycle status from LocalDate boundaries", () => {
  assert.equal(
    resolveEmployeeContractStatus(contract(), "2025-12-31"),
    EmployeeContractStatus.UPCOMING,
  );
  assert.equal(
    resolveEmployeeContractStatus(contract(), "2026-12-31"),
    EmployeeContractStatus.ACTIVE,
  );
  assert.equal(
    resolveEmployeeContractStatus(contract(), "2027-01-01"),
    EmployeeContractStatus.EXPIRED,
  );
  assert.equal(
    resolveEmployeeContractStatus(
      contract({ termination_date: "2026-07-15" }),
      "2026-07-15",
    ),
    EmployeeContractStatus.TERMINATED,
  );
});
