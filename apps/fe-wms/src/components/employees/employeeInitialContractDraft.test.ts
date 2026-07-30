import assert from "node:assert/strict";
import test from "node:test";

import { EmployeeContractType } from "@bduck/shared-types";

import {
  buildEmployeeInitialContractDraft,
  buildEmployeeProfileContractBundle,
  emptyInitialContractForm,
} from "./employeeInitialContractDraft.js";

test("returns no contract when the optional section is disabled", () => {
  assert.deepEqual(
    buildEmployeeInitialContractDraft(emptyInitialContractForm()),
    { ok: true, value: null },
  );
});

test("normalizes a fixed-term contract entered with DD-MM-YYYY dates", () => {
  const result = buildEmployeeInitialContractDraft({
    ...emptyInitialContractForm(),
    enabled: true,
    contract_number: "  HD-2026-001  ",
    start_date: "01-08-2026",
    end_date: "31-07-2027",
    notes: "  Hợp đồng đầu tiên  ",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      contract_number: "HD-2026-001",
      contract_type: EmployeeContractType.FIXED_TERM,
      start_date: "2026-08-01",
      end_date: "2027-07-31",
      notes: "Hợp đồng đầu tiên",
    },
  });
});

test("allows an indefinite contract without an end date", () => {
  const result = buildEmployeeInitialContractDraft({
    ...emptyInitialContractForm(),
    enabled: true,
    contract_number: "HD-KXD-001",
    contract_type: EmployeeContractType.INDEFINITE,
    start_date: "01-08-2026",
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value?.end_date, null);
});

test("rejects a missing or reversed fixed-term date range", () => {
  const missingEnd = buildEmployeeInitialContractDraft({
    ...emptyInitialContractForm(),
    enabled: true,
    contract_number: "HD-001",
    start_date: "01-08-2026",
  });
  const reversed = buildEmployeeInitialContractDraft({
    ...emptyInitialContractForm(),
    enabled: true,
    contract_number: "HD-002",
    start_date: "01-08-2026",
    end_date: "31-07-2026",
  });

  assert.deepEqual(missingEnd, { ok: false, error: "INVALID_DATE" });
  assert.deepEqual(reversed, { ok: false, error: "INVALID_DATE" });
});

test("rejects a non-PDF attachment in the combined create flow", () => {
  const result = buildEmployeeProfileContractBundle({
    form: {
      ...emptyInitialContractForm(),
      enabled: true,
      contract_number: "HD-003",
      start_date: "01-08-2026",
      end_date: "31-07-2027",
      pdf_file: {
        name: "contract.exe",
        type: "application/octet-stream",
        size: 100,
      } as File,
    },
    canManageContract: true,
    canManageDocument: true,
    submissionId: "submission-1",
  });

  assert.deepEqual(result, { ok: false, error: "INVALID_PDF" });
});
