"use client";

import type {
  CancelEmployeeContractInput,
  CreateEmployeeContractDocumentUploadIntentInput,
  CreateEmployeeContractInput,
  EmployeeContract,
  EmployeeContractDocument,
  EmployeeContractDocumentMutationResult,
  EmployeeContractExpiryView,
  EmployeeContractMutationResult,
  EmployeeContractSignedDownload,
  EmployeeContractSignedUploadIntent,
  FinalizeEmployeeContractDocumentUploadInput,
  RenewEmployeeContractInput,
  TerminateEmployeeContractInput,
  UpdateEmployeeContractInput,
} from "@bduck/shared-types";

import { createDetailedApiError } from "@/utils/apiError";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const contractPath = (profileId: string, suffix = "") =>
  `/api/employee-profiles/${encodeURIComponent(profileId)}/contracts${suffix}`;

const contractFetch = async <T>(
  path: string,
  fallbackMessage: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
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

export const createContractIdempotencyKey = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID()}`;

export const fetchEmployeeContracts = (
  profileId: string,
  fallbackMessage: string,
  signal?: AbortSignal,
) =>
  contractFetch<EmployeeContract[]>(contractPath(profileId), fallbackMessage, {
    signal,
  });

export const fetchExpiringEmployeeContracts = (
  fallbackMessage: string,
  signal?: AbortSignal,
) =>
  contractFetch<EmployeeContractExpiryView[]>(
    "/api/employee-contracts/expiring?limit=100",
    fallbackMessage,
    { signal },
  );

export const createEmployeeContract = (
  profileId: string,
  input: CreateEmployeeContractInput,
  fallbackMessage: string,
) =>
  contractFetch<EmployeeContractMutationResult>(
    contractPath(profileId),
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const updateEmployeeContract = (
  profileId: string,
  contractId: string,
  input: UpdateEmployeeContractInput,
  fallbackMessage: string,
) =>
  contractFetch<EmployeeContractMutationResult>(
    contractPath(profileId, `/${encodeURIComponent(contractId)}`),
    fallbackMessage,
    { method: "PUT", body: JSON.stringify(input) },
  );

export const renewEmployeeContract = (
  profileId: string,
  contractId: string,
  input: RenewEmployeeContractInput,
  fallbackMessage: string,
) =>
  contractFetch<EmployeeContractMutationResult>(
    contractPath(profileId, `/${encodeURIComponent(contractId)}/renew`),
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const cancelEmployeeContract = (
  profileId: string,
  contractId: string,
  input: CancelEmployeeContractInput,
  fallbackMessage: string,
) =>
  contractFetch<EmployeeContractMutationResult>(
    contractPath(profileId, `/${encodeURIComponent(contractId)}/cancel`),
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const terminateEmployeeContract = (
  profileId: string,
  contractId: string,
  input: TerminateEmployeeContractInput,
  fallbackMessage: string,
) =>
  contractFetch<EmployeeContractMutationResult>(
    contractPath(profileId, `/${encodeURIComponent(contractId)}/terminate`),
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const fetchEmployeeContractDocuments = (
  profileId: string,
  contractId: string,
  fallbackMessage: string,
  signal?: AbortSignal,
) =>
  contractFetch<EmployeeContractDocument[]>(
    contractPath(profileId, `/${encodeURIComponent(contractId)}/documents`),
    fallbackMessage,
    { signal },
  );

export const uploadEmployeeContractPdf = async (
  profileId: string,
  contractId: string,
  file: File,
  fallbackMessage: string,
): Promise<EmployeeContractDocumentMutationResult> => {
  const intentInput: CreateEmployeeContractDocumentUploadIntentInput = {
    original_file_name: file.name,
    idempotency_key: createContractIdempotencyKey("contract-pdf-intent"),
    action_time: new Date(),
  };
  const signedIntent = await contractFetch<EmployeeContractSignedUploadIntent>(
    contractPath(
      profileId,
      `/${encodeURIComponent(contractId)}/documents/upload-intents`,
    ),
    fallbackMessage,
    { method: "POST", body: JSON.stringify(intentInput) },
  );
  const form = new FormData();
  Object.entries(signedIntent.fields).forEach(([key, value]) =>
    form.append(key, value),
  );
  form.append("file", file);
  const uploadResponse = await fetch(signedIntent.upload_url, {
    method: signedIntent.method,
    body: form,
    mode: "no-cors",
  });
  if (uploadResponse.type !== "opaque" && !uploadResponse.ok) {
    throw new Error(fallbackMessage);
  }
  const finalizeInput: FinalizeEmployeeContractDocumentUploadInput = {
    idempotency_key: createContractIdempotencyKey("contract-pdf-finalize"),
    action_time: new Date(),
  };
  return contractFetch<EmployeeContractDocumentMutationResult>(
    contractPath(
      profileId,
      `/${encodeURIComponent(contractId)}/documents/upload-intents/${signedIntent.intent.id}/finalize`,
    ),
    fallbackMessage,
    { method: "POST", body: JSON.stringify(finalizeInput) },
  );
};

export const fetchEmployeeContractDocumentDownload = (
  profileId: string,
  contractId: string,
  documentId: string,
  fallbackMessage: string,
  mode: "view" | "download" = "view",
) =>
  contractFetch<EmployeeContractSignedDownload>(
    contractPath(
      profileId,
      `/${encodeURIComponent(contractId)}/documents/${encodeURIComponent(documentId)}/download?mode=${mode}`,
    ),
    fallbackMessage,
  );
