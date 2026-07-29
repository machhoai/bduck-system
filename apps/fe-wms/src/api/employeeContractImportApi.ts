"use client";

import type {
  CommitEmployeeContractImportInput,
  EmployeeContractImportBatchView,
  EmployeeContractImportCommitResult,
  EmployeeContractImportUploadSession,
} from "@bduck/shared-types";

import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const BASE_PATH = "/api/employee-contract-imports";

const importFetch = async <T>(
  path: string,
  fallbackMessage: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await authenticatedFetch(`${API_BASE_URL}${BASE_PATH}${path}`, {
    ...init,
    headers: init.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init.headers,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, fallbackMessage);
  }
  return body.data as T;
};

const fileSha256 = async (file: File): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const uploadSignedFile = async (
  upload: EmployeeContractImportUploadSession["uploads"][number],
  file: File,
  fallbackMessage: string,
) => {
  const form = new FormData();
  Object.entries(upload.fields).forEach(([key, value]) =>
    form.append(key, value),
  );
  form.append("file", file);
  const response = await fetch(upload.upload_url, {
    method: upload.method,
    body: form,
    mode: "no-cors",
  });
  if (response.type !== "opaque" && !response.ok) {
    throw new Error(fallbackMessage);
  }
};

export const previewEmployeeContractHistoryFiles = async (
  excel: File,
  pdfs: File[],
  fallbackMessage: string,
): Promise<EmployeeContractImportBatchView> => {
  const files = [
    { original_file_name: excel.name, kind: "EXCEL" as const },
    ...pdfs.map((file) => ({
      original_file_name: file.name,
      kind: "PDF" as const,
    })),
  ];
  const selected = [excel, ...pdfs];
  const hashesPromise = Promise.all(selected.map(fileSha256));
  const session = await importFetch<EmployeeContractImportUploadSession>(
    "/upload-sessions",
    fallbackMessage,
    {
      method: "POST",
      body: JSON.stringify({
        files,
        idempotency_key: `contract-import-upload-${crypto.randomUUID()}`,
        action_time: new Date(),
      }),
    },
  );
  const [hashes] = await Promise.all([
    hashesPromise,
    Promise.all(
      session.uploads.map((upload, index) =>
        uploadSignedFile(upload, selected[index], fallbackMessage),
      ),
    ),
  ]);
  const excelUpload = session.uploads.find((upload) => upload.kind === "EXCEL")!;
  const pdfUploads = session.uploads.filter((upload) => upload.kind === "PDF");
  return importFetch<EmployeeContractImportBatchView>(
    "/preview",
    fallbackMessage,
    {
      method: "POST",
      body: JSON.stringify({
        upload_session_id: session.id,
        source_file_name: excel.name,
        source_file_path: excelUpload.storage_path,
        source_file_checksum: hashes[0],
        pdf_files: pdfUploads.map((upload, index) => ({
          original_file_name: upload.original_file_name,
          storage_path: upload.storage_path,
          sha256: hashes[index + 1],
        })),
        action_time: new Date(),
      }),
    },
  );
};

export const fetchEmployeeContractImportBatch = (
  batchId: string,
  fallbackMessage: string,
) =>
  importFetch<EmployeeContractImportBatchView>(
    `/${encodeURIComponent(batchId)}`,
    fallbackMessage,
  );

export const commitEmployeeContractImportBatch = (
  batchId: string,
  input: CommitEmployeeContractImportInput,
  fallbackMessage: string,
) =>
  importFetch<EmployeeContractImportCommitResult>(
    `/${encodeURIComponent(batchId)}/commit`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );
