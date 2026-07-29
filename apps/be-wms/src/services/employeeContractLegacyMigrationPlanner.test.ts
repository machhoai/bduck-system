import {
  EmployeeContractType,
  EmployeeProfileStatus,
  type EmployeeContract,
  type EmployeeContractImportNormalizedPayload,
  type EmployeeProfile,
} from "@bduck/shared-types";
import assert from "node:assert/strict";
import test from "node:test";
import type { ParsedEmployeeContractImportRow } from "./employeeContractImportWorkbookService.js";
import { planEmployeeContractLegacyMigration } from "./employeeContractLegacyMigrationPlanner.js";

const profile: EmployeeProfile = {
  id: "profile-1",
  user_id: "user-1",
  employee_code: "NV001",
  full_name: "Nguyễn Văn A",
  email: null,
  phone: null,
  job_title: null,
  department: null,
  workplace_warehouse_id: "facility-1",
  status: EmployeeProfileStatus.ACTIVE,
  notes: null,
  is_deleted: false,
  created_at: new Date("2024-01-01T00:00:00.000Z"),
  updated_at: new Date("2024-01-01T00:00:00.000Z"),
};

const payload = (
  patch: Partial<EmployeeContractImportNormalizedPayload> = {},
): EmployeeContractImportNormalizedPayload => ({
  employee_code: "NV001",
  contract_number: "HD-001",
  contract_type: EmployeeContractType.FIXED_TERM,
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  lifecycle_state: null,
  lifecycle_date: null,
  lifecycle_reason: null,
  pdf_file_name: null,
  notes: null,
  ...patch,
});

const row = (
  rowNumber: number,
  patch: Partial<EmployeeContractImportNormalizedPayload> = {},
): ParsedEmployeeContractImportRow => ({
  row_number: rowNumber,
  employee_code: patch.employee_code ?? "NV001",
  source_reference: `Contracts!${rowNumber}`,
  normalized_payload: payload(patch),
  parse_messages: [],
});

test("legacy migration plans a valid historical contract", () => {
  const [result] = planEmployeeContractLegacyMigration({
    rows: [row(6)],
    profiles: [profile],
    existing_contracts: [],
    actor_id: "hr-1",
    now: new Date("2026-07-29T00:00:00.000Z"),
  });
  assert.equal(result.messages.length, 0);
  assert.equal(result.profile?.id, profile.id);
  assert.equal(result.candidate?.contract_number, "HD-001");
});

test("legacy migration rejects optional PDF names in CLI preview", () => {
  const [result] = planEmployeeContractLegacyMigration({
    rows: [row(6, { pdf_file_name: "HD-001.pdf" })],
    profiles: [profile],
    existing_contracts: [],
    actor_id: "hr-1",
    now: new Date("2026-07-29T00:00:00.000Z"),
  });
  assert.equal(result.candidate, null);
  assert.match(result.messages[0]?.vi ?? "", /không nhận PDF/i);
});

test("legacy migration blocks duplicate numbers and overlapping periods", () => {
  const existing = {
    ...planEmployeeContractLegacyMigration({
      rows: [row(6)],
      profiles: [profile],
      existing_contracts: [],
      actor_id: "hr-1",
      now: new Date("2026-07-29T00:00:00.000Z"),
    })[0].candidate!,
    id: "existing-contract",
  } as EmployeeContract;
  const [result] = planEmployeeContractLegacyMigration({
    rows: [row(7, { start_date: "2025-06-01", end_date: "2026-05-31" })],
    profiles: [profile],
    existing_contracts: [existing],
    actor_id: "hr-1",
    now: new Date("2026-07-29T00:00:00.000Z"),
  });
  assert.equal(result.candidate, null);
  assert.ok(result.messages.some((item) => /đã tồn tại/i.test(item.vi)));
  assert.ok(result.messages.some((item) => /khoảng thời gian/i.test(item.vi)));
});
