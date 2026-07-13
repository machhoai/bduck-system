import { createDetailedApiError } from "@/utils/apiError";
import type { ApprovalLevel, ProcessConfig } from "@bduck/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type ExternalQueueAutoSubmitSchedule = {
  id: string;
  enabled: boolean;
  times: string[];
  timezone: "GMT+7";
  last_run_key?: string | null;
  last_run_at?: string | null;
  last_run_result?: {
    submitted_batches: number;
    submitted_scans: number;
  } | null;
};

export type ExternalQueueScannableProduct = {
  id: string;
  name: string;
  code: string;
  barcode?: string | null;
  unit?: string | null;
};

export type ExternalQueueScannableProductConfig = {
  id: string;
  warehouse_id: string;
  warehouse_location_id: string;
  product_ids: string[];
  products: ExternalQueueScannableProduct[];
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ExternalQueueApprovalConfigPayload = {
  warehouse_id: string;
  auto_approve: boolean;
  approval_chain: ApprovalLevel[];
};

async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}/api/external-queue${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw createDetailedApiError(
      response,
      errorData,
      `API Error: ${response.status}`,
    );
  }

  return response.json();
}

export const externalQueueApi = {
  getPendingBatches: () => apiFetch<any>("/pending"),

  getHistory: (params?: { warehouse_id?: string; status?: string }) => {
    const urlParams = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return apiFetch<any>(`/history${urlParams ? `?${urlParams}` : ""}`);
  },

  approveBatch: (data: {
    batch_id: string;
    approved_items: { scan_id: string; quantity: number }[];
    notes?: string | null;
  }) =>
    apiFetch<any>("/approve", { method: "POST", body: JSON.stringify(data) }),

  updateQuantity: (data: {
    scan_id: string;
    quantity: number;
    reason?: string | null;
  }) =>
    apiFetch<any>("/update-quantity", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  cancelScan: (data: { scan_id: string; reason?: string | null }) =>
    apiFetch<any>("/cancel-scan", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAutoSubmitSchedule: () =>
    apiFetch<{ success: boolean; data: ExternalQueueAutoSubmitSchedule }>(
      "/auto-submit-schedule",
    ),

  updateAutoSubmitSchedule: (data: { enabled: boolean; times: string[] }) =>
    apiFetch<{ success: boolean; data: ExternalQueueAutoSubmitSchedule }>(
      "/auto-submit-schedule",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ),

  autoSubmit: (data?: {
    warehouse_id?: string;
    warehouse_location_id?: string;
    older_than_minutes?: number;
  }) =>
    apiFetch<any>("/auto-submit", {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  rejectBatch: (data: { batch_id: string; reason: string }) =>
    apiFetch<any>("/reject", { method: "POST", body: JSON.stringify(data) }),

  getScannableProductsConfig: (params: {
    warehouse_id: string;
    warehouse_location_id: string;
  }) => {
    const urlParams = new URLSearchParams(params).toString();
    return apiFetch<{
      success: boolean;
      data: ExternalQueueScannableProductConfig | null;
    }>(`/scannable-products?${urlParams}`);
  },

  updateScannableProductsConfig: (data: {
    warehouse_id: string;
    warehouse_location_id: string;
    product_ids: string[];
  }) =>
    apiFetch<{
      success: boolean;
      data: ExternalQueueScannableProductConfig;
    }>("/scannable-products", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getApprovalConfig: (params: { warehouse_id: string }) => {
    const urlParams = new URLSearchParams(params).toString();
    return apiFetch<{ success: boolean; data: ProcessConfig }>(
      `/approval-config?${urlParams}`,
    );
  },

  updateApprovalConfig: (data: ExternalQueueApprovalConfigPayload) =>
    apiFetch<{ success: boolean; data: ProcessConfig }>("/approval-config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
