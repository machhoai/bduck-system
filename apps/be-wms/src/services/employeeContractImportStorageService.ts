import { createHash } from "node:crypto";

import {
  EMPLOYEE_CONTRACT_IMPORT_EXCEL_MAX_BYTES,
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  type CreateEmployeeContractImportUploadSessionInput,
  type EmployeeContractImportStagedDocument,
  type EmployeeContractImportUploadSession,
  type EmployeeContractImportUploadedPdf,
} from "@bduck/shared-types";

import { storage } from "../config/firebase.js";

import { inspectEmployeeContractPdf } from "./employeeContractPdfPolicy.js";

const UPLOAD_TTL_MS = 10 * 60 * 1000;
const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const bucket = () => storage.bucket();
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

const safeFileName = (value: string): string => {
  const extension = value.toLowerCase().endsWith(".pdf") ? ".pdf" : ".xlsx";
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\.[^.]+$/u, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 180);
  return `${base || "file"}${extension}`;
};

const metadataValue = (
  metadata: Record<string, string | undefined> | undefined,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    if (metadata?.[key]) return metadata[key];
  }
  return undefined;
};

const importError = (
  code: string,
  vi: string,
  zh: string,
  statusCode = 400,
) => ({ code, messages: { vi, zh }, statusCode });

export const createEmployeeContractImportUploadSession = async (
  input: CreateEmployeeContractImportUploadSessionInput,
  actorId: string,
): Promise<EmployeeContractImportUploadSession> => {
  const id = sha256(`${actorId}:CONTRACT_IMPORT_UPLOAD:${input.idempotency_key}`);
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
  const uploads = await Promise.all(
    input.files.map(async (item, index) => {
      const contentType = item.kind === "EXCEL" ? EXCEL_MIME : "application/pdf";
      const maxFileSize =
        item.kind === "EXCEL"
          ? EMPLOYEE_CONTRACT_IMPORT_EXCEL_MAX_BYTES
          : EMPLOYEE_CONTRACT_PDF_MAX_BYTES;
      const storagePath = [
        "employee-contract-imports",
        actorId,
        id,
        `${String(index).padStart(3, "0")}-${safeFileName(item.original_file_name)}`,
      ].join("/");
      const [policy] = await bucket().file(storagePath).generateSignedPostPolicyV4({
        expires: expiresAt,
        fields: {
          "Content-Type": contentType,
          "x-goog-meta-import-session-id": id,
          "x-goog-meta-import-actor-id": actorId,
          "x-goog-meta-import-file-kind": item.kind,
          "x-goog-meta-original-file-name": encodeURIComponent(
            item.original_file_name,
          ),
        },
        conditions: [
          ["content-length-range", 1, maxFileSize],
          ["eq", "$Content-Type", contentType],
          { "x-goog-meta-import-session-id": id },
          { "x-goog-meta-import-actor-id": actorId },
          { "x-goog-meta-import-file-kind": item.kind },
        ],
      });
      return {
        original_file_name: item.original_file_name,
        kind: item.kind,
        storage_path: storagePath,
        method: "POST" as const,
        upload_url: policy.url,
        fields: policy.fields,
        expires_at: expiresAt,
        max_file_size: maxFileSize,
      };
    }),
  );
  return { id, uploads, expires_at: expiresAt };
};

const assertStagedMetadata = async (input: {
  storagePath: string;
  sessionId: string;
  actorId: string;
  kind: "EXCEL" | "PDF";
  maxBytes: number;
}) => {
  const expectedPrefix = `employee-contract-imports/${input.actorId}/${input.sessionId}/`;
  if (!input.storagePath.startsWith(expectedPrefix)) {
    throw importError(
      "CONTRACT_IMPORT_STORAGE_PATH_INVALID",
      "Đường dẫn tệp import không thuộc phiên tải lên hiện tại.",
      "导入文件路径不属于当前上传会话。",
    );
  }
  const file = bucket().file(input.storagePath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  const custom = metadata.metadata as Record<string, string | undefined>;
  if (!Number.isSafeInteger(size) || size < 1 || size > input.maxBytes) {
    throw importError(
      "CONTRACT_IMPORT_FILE_SIZE_INVALID",
      "Kích thước tệp import không hợp lệ hoặc vượt giới hạn.",
      "导入文件大小无效或超过限制。",
      size > input.maxBytes ? 413 : 400,
    );
  }
  if (
    metadataValue(custom, "importSessionId", "import-session-id") !==
      input.sessionId ||
    metadataValue(custom, "importActorId", "import-actor-id") !== input.actorId ||
    metadataValue(custom, "importFileKind", "import-file-kind") !== input.kind
  ) {
    throw importError(
      "CONTRACT_IMPORT_FILE_METADATA_INVALID",
      "Metadata của tệp import không hợp lệ.",
      "导入文件元数据无效。",
    );
  }
  const [buffer] = await file.download({ validation: "crc32c" });
  return {
    buffer,
    size,
    generation: String(metadata.generation ?? ""),
    contentType: metadata.contentType,
  };
};

export const verifyEmployeeContractImportExcel = async (input: {
  storage_path: string;
  expected_sha256: string;
  session_id: string;
  actor_id: string;
}): Promise<Buffer> => {
  const verified = await assertStagedMetadata({
    storagePath: input.storage_path,
    sessionId: input.session_id,
    actorId: input.actor_id,
    kind: "EXCEL",
    maxBytes: EMPLOYEE_CONTRACT_IMPORT_EXCEL_MAX_BYTES,
  });
  if (
    verified.contentType !== EXCEL_MIME ||
    verified.buffer[0] !== 0x50 ||
    verified.buffer[1] !== 0x4b ||
    sha256(verified.buffer) !== input.expected_sha256
  ) {
    throw importError(
      "CONTRACT_IMPORT_EXCEL_INVALID",
      "Tệp Excel không hợp lệ hoặc nội dung đã thay đổi.",
      "Excel 文件无效或内容已更改。",
    );
  }
  return verified.buffer;
};

export const verifyEmployeeContractImportPdfs = async (input: {
  files: EmployeeContractImportUploadedPdf[];
  session_id: string;
  actor_id: string;
}): Promise<Map<string, EmployeeContractImportStagedDocument>> => {
  const entries = await Promise.all(
    input.files.map(async (item) => {
      const verified = await assertStagedMetadata({
        storagePath: item.storage_path,
        sessionId: input.session_id,
        actorId: input.actor_id,
        kind: "PDF",
        maxBytes: EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
      });
      const inspected = inspectEmployeeContractPdf({
        buffer: verified.buffer,
        original_file_name: item.original_file_name,
        content_type: verified.contentType,
        declared_size: verified.size,
        expected_upload_intent_id: input.session_id,
        actual_upload_intent_id: input.session_id,
      });
      if (inspected.sha256 !== item.sha256) {
        throw importError(
          "CONTRACT_IMPORT_PDF_CHECKSUM_MISMATCH",
          `Tệp PDF "${item.original_file_name}" đã thay đổi sau khi tải lên.`,
          `PDF 文件“${item.original_file_name}”上传后已更改。`,
        );
      }
      return [
        item.original_file_name.normalize("NFKC").toLowerCase(),
        {
          original_file_name: item.original_file_name,
          storage_path: item.storage_path,
          storage_generation: verified.generation,
          file_size: inspected.file_size,
          sha256: inspected.sha256,
          mime_type: "application/pdf" as const,
        },
      ] as const;
    }),
  );
  return new Map(entries);
};

export const persistEmployeeContractImportPdf = async (
  staged: EmployeeContractImportStagedDocument,
  batchId: string,
  rowId: string,
): Promise<EmployeeContractImportStagedDocument> => {
  const source = bucket().file(staged.storage_path);
  const [metadata] = await source.getMetadata();
  if (String(metadata.generation ?? "") !== staged.storage_generation) {
    throw importError(
      "CONTRACT_IMPORT_PDF_GENERATION_CHANGED",
      `Tệp PDF "${staged.original_file_name}" đã thay đổi sau khi preview.`,
      `PDF 文件“${staged.original_file_name}”预览后已更改。`,
      409,
    );
  }
  const [buffer] = await source.download({ validation: "crc32c" });
  if (sha256(buffer) !== staged.sha256) {
    throw importError(
      "CONTRACT_IMPORT_PDF_CHECKSUM_MISMATCH",
      `Tệp PDF "${staged.original_file_name}" không còn khớp checksum.`,
      `PDF 文件“${staged.original_file_name}”校验和不再匹配。`,
      409,
    );
  }
  const storagePath = `employee-contract-documents/imports/${batchId}/${rowId}/${staged.sha256}.pdf`;
  const target = bucket().file(storagePath);
  try {
    await target.save(buffer, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "application/pdf",
        cacheControl: "private, no-store, max-age=0",
        metadata: { batchId, rowId, sha256: staged.sha256 },
      },
    });
  } catch (error) {
    const code = Number((error as { code?: number | string }).code);
    if (code !== 409 && code !== 412) throw error;
  }
  const [targetMetadata] = await target.getMetadata();
  return {
    ...staged,
    storage_path: storagePath,
    storage_generation: String(targetMetadata.generation ?? ""),
  };
};
