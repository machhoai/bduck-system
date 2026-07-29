import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmployeeContractUploadIntentSchema,
  employeeContractDocumentDownloadQuerySchema,
  employeeContractDocumentParamsSchema,
  finalizeEmployeeContractUploadSchema,
} from "./employeeContractDocumentSchemas.js";

const action = {
  idempotency_key: "contract-pdf-upload-001",
  action_time: "2026-07-29T10:00:00.000Z",
};

test("accepts a strict PDF upload intent and converts action_time", () => {
  const parsed = createEmployeeContractUploadIntentSchema.parse({
    ...action,
    original_file_name: "hop-dong-2026.pdf",
  });
  assert.ok(parsed.action_time instanceof Date);
  assert.equal(parsed.original_file_name, "hop-dong-2026.pdf");
});

test("rejects paths, non-PDF names, NoSQL operators and unknown fields", () => {
  for (const original_file_name of [
    "../contract.pdf",
    "folder/contract.pdf",
    "contract.exe",
    "$where.pdf",
  ]) {
    assert.equal(
      createEmployeeContractUploadIntentSchema.safeParse({
        ...action,
        original_file_name,
      }).success,
      false,
    );
  }
  assert.equal(
    finalizeEmployeeContractUploadSchema.safeParse({
      ...action,
      unexpected: true,
    }).success,
    false,
  );
});

test("requires UUID resource identifiers", () => {
  assert.equal(
    employeeContractDocumentParamsSchema.safeParse({
      id: "profile",
      contractId: "contract",
      documentId: "document",
    }).success,
    false,
  );
});

test("accepts only supported signed download modes", () => {
  assert.equal(
    employeeContractDocumentDownloadQuerySchema.parse({}).mode,
    "view",
  );
  assert.equal(
    employeeContractDocumentDownloadQuerySchema.parse({
      mode: "download",
    }).mode,
    "download",
  );
  assert.equal(
    employeeContractDocumentDownloadQuerySchema.safeParse({
      mode: "public",
    }).success,
    false,
  );
});
