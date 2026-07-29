import assert from "node:assert/strict";
import test from "node:test";

import {
  commitEmployeeContractImportSchema,
  createEmployeeContractImportUploadSessionSchema,
  previewEmployeeContractImportSchema,
} from "./employeeContractImportSchemas.js";

const action = {
  idempotency_key: "contract-import-001",
  action_time: "2026-07-29T10:00:00.000Z",
};
const hash = "a".repeat(64);

test("accepts one Excel file and optional uniquely named PDFs", () => {
  const parsed = createEmployeeContractImportUploadSessionSchema.parse({
    ...action,
    files: [
      { original_file_name: "contracts.xlsx", kind: "EXCEL" },
      { original_file_name: "HD-001.pdf", kind: "PDF" },
    ],
  });
  assert.ok(parsed.action_time instanceof Date);
});

test("rejects duplicate names, paths and missing Excel files", () => {
  for (const files of [
    [{ original_file_name: "contract.pdf", kind: "PDF" }],
    [
      { original_file_name: "contracts.xlsx", kind: "EXCEL" },
      { original_file_name: "CONTRACTS.XLSX", kind: "EXCEL" },
    ],
    [{ original_file_name: "../contracts.xlsx", kind: "EXCEL" }],
  ]) {
    assert.equal(
      createEmployeeContractImportUploadSessionSchema.safeParse({
        ...action,
        files,
      }).success,
      false,
    );
  }
});

test("accepts strict preview and commit payloads", () => {
  assert.equal(
    previewEmployeeContractImportSchema.safeParse({
      upload_session_id: hash,
      source_file_name: "contracts.xlsx",
      source_file_path: `employee-contract-imports/user/${hash}/contracts.xlsx`,
      source_file_checksum: hash,
      pdf_files: [],
      action_time: action.action_time,
    }).success,
    true,
  );
  assert.equal(
    commitEmployeeContractImportSchema.safeParse({
      ...action,
      expected_batch_checksum: hash,
    }).success,
    true,
  );
});
