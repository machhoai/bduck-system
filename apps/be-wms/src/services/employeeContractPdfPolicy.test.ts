import { EMPLOYEE_CONTRACT_PDF_MAX_BYTES } from "@bduck/shared-types";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { inspectEmployeeContractPdf } from "./employeeContractPdfPolicy.js";

const validPdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
);
const inspect = (
  overrides: Partial<Parameters<typeof inspectEmployeeContractPdf>[0]> = {},
) =>
  inspectEmployeeContractPdf({
    buffer: validPdf,
    original_file_name: "contract.pdf",
    content_type: "application/pdf",
    declared_size: validPdf.length,
    expected_upload_intent_id: "intent-1",
    actual_upload_intent_id: "intent-1",
    ...overrides,
  });

const hasCode = (code: string) => (error: unknown) =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code,
  );

test("validates PDF structure and calculates SHA-256", () => {
  const result = inspect();
  assert.equal(result.file_size, validPdf.length);
  assert.equal(
    result.sha256,
    createHash("sha256").update(validPdf).digest("hex"),
  );
});

test("rejects invalid structure, MIME, extension and upload metadata", () => {
  assert.throws(
    () =>
      inspect({
        buffer: Buffer.from("not a pdf"),
        declared_size: Buffer.byteLength("not a pdf"),
      }),
    hasCode("CONTRACT_DOCUMENT_INVALID"),
  );
  assert.throws(
    () => inspect({ content_type: "application/octet-stream" }),
    hasCode("CONTRACT_DOCUMENT_MIME_INVALID"),
  );
  assert.throws(
    () => inspect({ original_file_name: "contract.exe" }),
    hasCode("CONTRACT_DOCUMENT_INVALID"),
  );
  assert.throws(
    () => inspect({ actual_upload_intent_id: "intent-2" }),
    hasCode("CONTRACT_DOCUMENT_UPLOAD_MISMATCH"),
  );
});

test("rejects files larger than 10MB", () => {
  const oversizedPdf = Buffer.concat([
    Buffer.from("%PDF-1.7\n"),
    Buffer.alloc(EMPLOYEE_CONTRACT_PDF_MAX_BYTES, 32),
    Buffer.from("\n%%EOF"),
  ]);
  assert.throws(
    () =>
      inspect({
        buffer: oversizedPdf,
        declared_size: oversizedPdf.length,
      }),
    hasCode("CONTRACT_DOCUMENT_TOO_LARGE"),
  );
});
