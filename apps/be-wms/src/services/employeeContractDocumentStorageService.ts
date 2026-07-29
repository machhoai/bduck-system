import {
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  type EmployeeContractDocument,
  type EmployeeContractDocumentUploadIntent,
  type EmployeeContractSignedDownload,
  type EmployeeContractSignedUploadIntent,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";

import { storage } from "../config/firebase.js";
import {
  inspectEmployeeContractPdf,
  sanitizeEmployeeContractPdfFileName,
} from "./employeeContractPdfPolicy.js";

export const EMPLOYEE_CONTRACT_UPLOAD_TTL_MS = 10 * 60 * 1000;
export const EMPLOYEE_CONTRACT_DOWNLOAD_TTL_MS = 5 * 60 * 1000;

export interface PersistedEmployeeContractPdf {
  storage_path: string;
  storage_generation: string;
  file_size: number;
  sha256: string;
}

const bucket = () => storage.bucket();

export const buildEmployeeContractUploadStoragePath = (
  intentId: string,
  employeeProfileId: string,
  contractId: string,
  originalFileName: string,
): string =>
  [
    "employee-contract-uploads",
    employeeProfileId,
    contractId,
    intentId,
    sanitizeEmployeeContractPdfFileName(originalFileName),
  ].join("/");

const buildPermanentStoragePath = (
  intent: EmployeeContractDocumentUploadIntent,
  sha256: string,
): string =>
  [
    "employee-contract-documents",
    intent.employee_profile_id,
    intent.contract_id,
    intent.id,
    `${sha256}.pdf`,
  ].join("/");

export const createEmployeeContractSignedUpload = async (
  intent: EmployeeContractDocumentUploadIntent,
): Promise<EmployeeContractSignedUploadIntent> => {
  const file = bucket().file(intent.upload_storage_path);
  const [policy] = await file.generateSignedPostPolicyV4({
    expires: intent.expires_at,
    fields: {
      "Content-Type": "application/pdf",
      "x-goog-meta-upload-intent-id": intent.id,
      "x-goog-meta-contract-id": intent.contract_id,
    },
    conditions: [
      ["content-length-range", 1, EMPLOYEE_CONTRACT_PDF_MAX_BYTES],
      ["eq", "$Content-Type", "application/pdf"],
      { "x-goog-meta-upload-intent-id": intent.id },
      { "x-goog-meta-contract-id": intent.contract_id },
    ],
  });
  return {
    intent,
    method: "POST",
    upload_url: policy.url,
    fields: policy.fields,
    expires_at: intent.expires_at,
    max_file_size: EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  };
};

const customMetadataValue = (
  metadata: Record<string, string | undefined> | undefined,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (value) return value;
  }
  return undefined;
};

const assertMetadataSize = (size: string | number | undefined): number => {
  const parsed = Number(size);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > EMPLOYEE_CONTRACT_PDF_MAX_BYTES
  ) {
    throw {
      code: "CONTRACT_DOCUMENT_TOO_LARGE",
      statusCode: parsed > EMPLOYEE_CONTRACT_PDF_MAX_BYTES ? 413 : 400,
      messages: {
        vi: "Kích thước tệp hợp đồng không hợp lệ hoặc vượt quá 10MB.",
        zh: "合同文件大小无效或超过 10MB。",
      },
    };
  }
  return parsed;
};

const persistVerifiedBuffer = async (
  intent: EmployeeContractDocumentUploadIntent,
  buffer: Buffer,
  sha256: string,
): Promise<{ storage_path: string; storage_generation: string }> => {
  const storagePath = buildPermanentStoragePath(intent, sha256);
  const target = bucket().file(storagePath);
  let created = false;
  try {
    await target.save(buffer, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "application/pdf",
        cacheControl: "private, no-store, max-age=0",
        metadata: {
          uploadIntentId: intent.id,
          contractId: intent.contract_id,
          sha256,
        },
      },
    });
    created = true;
  } catch (error) {
    const statusCode = Number((error as { code?: number | string }).code);
    if (statusCode !== 409 && statusCode !== 412) throw error;
  }
  if (!created) {
    const [existingBuffer] = await target.download({ validation: "crc32c" });
    const existingHash = createHash("sha256")
      .update(existingBuffer)
      .digest("hex");
    if (existingHash !== sha256) {
      throw {
        code: "CONTRACT_DOCUMENT_STORAGE_CONFLICT",
        statusCode: 409,
        messages: {
          vi: "Đường dẫn lưu tệp hợp đồng đã chứa nội dung khác.",
          zh: "合同文件存储路径已包含其他内容。",
        },
      };
    }
  }
  const [metadata] = await target.getMetadata();
  if (!metadata.generation) {
    throw {
      code: "CONTRACT_DOCUMENT_STORAGE_METADATA_INVALID",
      statusCode: 500,
      messages: {
        vi: "Không thể xác định phiên bản lưu trữ của tệp hợp đồng.",
        zh: "无法确定合同文件的存储版本。",
      },
    };
  }
  return {
    storage_path: storagePath,
    storage_generation: String(metadata.generation),
  };
};

export const verifyAndPersistEmployeeContractPdf = async (
  intent: EmployeeContractDocumentUploadIntent,
): Promise<PersistedEmployeeContractPdf> => {
  const source = bucket().file(intent.upload_storage_path);
  const [metadata] = await source.getMetadata();
  const fileSize = assertMetadataSize(metadata.size);
  const customMetadata = metadata.metadata as
    | Record<string, string | undefined>
    | undefined;
  const [buffer] = await source.download({ validation: "crc32c" });
  const verified = inspectEmployeeContractPdf({
    buffer,
    original_file_name: intent.original_file_name,
    content_type: metadata.contentType,
    declared_size: fileSize,
    expected_upload_intent_id: intent.id,
    actual_upload_intent_id: customMetadataValue(
      customMetadata,
      "uploadIntentId",
      "upload-intent-id",
    ),
  });
  const persisted = await persistVerifiedBuffer(
    intent,
    buffer,
    verified.sha256,
  );
  return { ...persisted, ...verified };
};

export const createEmployeeContractSignedDownload = async (
  document: EmployeeContractDocument,
  mode: "view" | "download" = "view",
): Promise<EmployeeContractSignedDownload> => {
  const expiresAt = new Date(Date.now() + EMPLOYEE_CONTRACT_DOWNLOAD_TTL_MS);
  const safeName = sanitizeEmployeeContractPdfFileName(
    document.original_file_name,
  );
  const [url] = await bucket()
    .file(document.storage_path)
    .getSignedUrl({
      action: "read",
      version: "v4",
      expires: expiresAt,
      responseType: "application/pdf",
      responseDisposition: `${mode === "download" ? "attachment" : "inline"}; filename="${safeName}"`,
      queryParams: { generation: document.storage_generation },
    });
  return {
    document_id: document.id,
    url,
    expires_at: expiresAt,
  };
};
