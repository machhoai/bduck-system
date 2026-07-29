import { EmployeeContractType } from "@bduck/shared-types";
import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelEmployeeContractSchema,
  createEmployeeContractSchema,
  terminateEmployeeContractSchema,
  updateEmployeeContractSchema,
} from "./employeeContractSchemas.js";

const createPayload = {
  contract_number: "HĐ-2026-001",
  contract_type: EmployeeContractType.FIXED_TERM,
  start_date: "2026-08-01",
  end_date: "2027-07-31",
  notes: null,
  idempotency_key: "create-contract-001",
  action_time: "2026-07-29T10:00:00.000Z",
};

test("parses a strict sanitized contract payload", () => {
  const parsed = createEmployeeContractSchema.parse(createPayload);
  assert.ok(parsed.action_time instanceof Date);
  assert.equal(parsed.contract_number, "HĐ-2026-001");
});

test("API accepts only YYYY-MM-DD LocalDate values", () => {
  assert.equal(
    createEmployeeContractSchema.safeParse({
      ...createPayload,
      start_date: "01-08-2026",
    }).success,
    false,
  );
  assert.equal(
    createEmployeeContractSchema.safeParse({
      ...createPayload,
      start_date: "2026-02-30",
    }).success,
    false,
  );
});

test("rejects NoSQL operators, null bytes and unknown fields", () => {
  for (const contractNumber of ["$where", "HD\u0000-001"]) {
    assert.equal(
      createEmployeeContractSchema.safeParse({
        ...createPayload,
        contract_number: contractNumber,
      }).success,
      false,
    );
  }
  assert.equal(
    createEmployeeContractSchema.safeParse({
      ...createPayload,
      unexpected: true,
    }).success,
    false,
  );
});

test("requires a real update and optimistic concurrency revision", () => {
  const metadataOnly = {
    expected_revision: 1,
    idempotency_key: "update-contract-001",
    action_time: "2026-07-29T10:00:00.000Z",
  };
  assert.equal(
    updateEmployeeContractSchema.safeParse(metadataOnly).success,
    false,
  );
  assert.equal(
    updateEmployeeContractSchema.safeParse({
      ...metadataOnly,
      expected_revision: 0,
      notes: "Điều chỉnh",
    }).success,
    false,
  );
  assert.equal(
    updateEmployeeContractSchema.safeParse({
      ...metadataOnly,
      notes: "Điều chỉnh",
    }).success,
    true,
  );
});

test("sanitizes cancellation and termination payloads", () => {
  const lifecycle = {
    reason: "Hai bên thống nhất",
    expected_revision: 2,
    idempotency_key: "lifecycle-contract-001",
    action_time: "2026-07-29T10:00:00.000Z",
  };
  assert.equal(cancelEmployeeContractSchema.safeParse(lifecycle).success, true);
  assert.equal(
    cancelEmployeeContractSchema.safeParse({
      ...lifecycle,
      reason: "$ne",
    }).success,
    false,
  );
  assert.equal(
    terminateEmployeeContractSchema.safeParse({
      ...lifecycle,
      termination_date: "29-07-2026",
    }).success,
    false,
  );
});
