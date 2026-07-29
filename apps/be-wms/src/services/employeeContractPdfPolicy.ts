import { createHash } from "node:crypto";

import { EMPLOYEE_CONTRACT_PDF_MAX_BYTES } from "@bduck/shared-types";

export type EmployeeContractPdfIssueCode =
  | "CONTRACT_DOCUMENT_INVALID"
  | "CONTRACT_DOCUMENT_TOO_LARGE"
  | "CONTRACT_DOCUMENT_MIME_INVALID"
  | "CONTRACT_DOCUMENT_UPLOAD_MISMATCH";

export interface EmployeeContractPdfInspectionInput {
  buffer: Buffer;
  original_file_name: string;
  content_type: string | undefined;
  declared_size: number;
  expected_upload_intent_id: string;
  actual_upload_intent_id: string | undefined;
}

export interface VerifiedEmployeeContractPdf {
  file_size: number;
  sha256: string;
}

const pdfError = (
  code: EmployeeContractPdfIssueCode,
  vi: string,
  zh: string,
) => ({
  code,
  statusCode: code === "CONTRACT_DOCUMENT_TOO_LARGE" ? 413 : 400,
  messages: { vi, zh },
});

export const sanitizeEmployeeContractPdfFileName = (
  fileName: string,
): string => {
  const normalized = fileName.normalize("NFKC").trim();
  const extensionSafe = normalized.replace(/[^a-zA-Z0-9._-]/gu, "_");
  return extensionSafe.slice(0, 240) || "contract.pdf";
};

const hasPdfHeader = (buffer: Buffer): boolean => {
  if (buffer.length < 8) return false;
  const header = buffer.subarray(0, 8).toString("ascii");
  return /^%PDF-(?:1\.[0-7]|2\.0)/u.test(header);
};

const hasPdfEofMarker = (buffer: Buffer): boolean => {
  const tail = buffer
    .subarray(Math.max(0, buffer.length - 2048))
    .toString("latin1");
  return tail.includes("%%EOF");
};

export const inspectEmployeeContractPdf = (
  input: EmployeeContractPdfInspectionInput,
): VerifiedEmployeeContractPdf => {
  if (
    input.buffer.length === 0 ||
    input.declared_size !== input.buffer.length ||
    !/\.pdf$/iu.test(input.original_file_name) ||
    !hasPdfHeader(input.buffer) ||
    !hasPdfEofMarker(input.buffer)
  ) {
    throw pdfError(
      "CONTRACT_DOCUMENT_INVALID",
      "Tệp tải lên không phải là PDF hợp lệ.",
      "上传的文件不是有效的 PDF。",
    );
  }
  if (input.buffer.length > EMPLOYEE_CONTRACT_PDF_MAX_BYTES) {
    throw pdfError(
      "CONTRACT_DOCUMENT_TOO_LARGE",
      "Tệp hợp đồng vượt quá giới hạn 10MB.",
      "合同文件超过 10MB 限制。",
    );
  }
  if (input.content_type !== "application/pdf") {
    throw pdfError(
      "CONTRACT_DOCUMENT_MIME_INVALID",
      "MIME của tệp hợp đồng phải là application/pdf.",
      "合同文件的 MIME 必须为 application/pdf。",
    );
  }
  if (
    !input.actual_upload_intent_id ||
    input.actual_upload_intent_id !== input.expected_upload_intent_id
  ) {
    throw pdfError(
      "CONTRACT_DOCUMENT_UPLOAD_MISMATCH",
      "Tệp tải lên không thuộc upload intent hiện tại.",
      "上传文件不属于当前上传意图。",
    );
  }
  return {
    file_size: input.buffer.length,
    sha256: createHash("sha256").update(input.buffer).digest("hex"),
  };
};
