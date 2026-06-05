"use client";

/**
 * Import Voucher API — FE HTTP client for import voucher endpoints.
 *
 * Follows the project pattern from useWorkflowApi.ts:
 * - Uses process.env.NEXT_PUBLIC_API_URL
 * - Sends credentials: "include" for cookie-based session auth
 * - Returns parsed JSON body
 * - Throws Error with vi message for toast consumption
 */

import { emitDataMutation } from "@/lib/dataInvalidation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
};

async function importVoucherApi<T>(
  path: string,
  method: "GET" | "POST" | "PUT",
  payload?: unknown,
): Promise<T> {
  const url = `${API_BASE_URL}/api/import-vouchers${path}`;

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Lỗi khi xử lý phiếu nhập kho.");
  }

  if (method !== "GET") {
    emitDataMutation(["import_vouchers", "audit_logs"]);
  }

  return body.data as T;
}

// ─────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────

export interface ImportVoucherListFilters {
  status?: string;
  creator_id?: string;
  approver_id?: string;
  warehouse_id?: string;
  voucher_number?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  cursor?: string;
}

export async function fetchImportVouchers(
  filters: ImportVoucherListFilters = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return importVoucherApi(`${qs ? `?${qs}` : ""}`, "GET");
}

// ─────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────

export async function fetchImportVoucherById(id: string) {
  return importVoucherApi(`/${id}`, "GET");
}

// ─────────────────────────────────────────────
// TIMELINE
// ─────────────────────────────────────────────

export async function fetchImportVoucherTimeline(id: string) {
  return importVoucherApi(`/${id}/timeline`, "GET");
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

export interface CreateImportVoucherPayload {
  warehouse_id: string;
  supplier_name: string;
  purchase_order_id?: string | null;
  items: Array<{
    product_id: string;
    warehouse_location_id: string | null;
    expected_quantity: number;
    actual_quantity?: number;
    unit_price: number;
    condition: string;
    notes?: string | null;
  }>;
  notes?: string | null;
  attachment_urls?: string[];
  action_time?: string;
  otp?: string;
}

export async function createImportVoucher(data: CreateImportVoucherPayload) {
  return importVoucherApi("/", "POST", data);
}

// ─────────────────────────────────────────────
// SAVE ACTUALS (Receiving Session)
// ─────────────────────────────────────────────

export interface SaveActualsPayload {
  items: Array<{
    id: string;
    actual_quantity: number;
    notes?: string | null;
  }>;
  action_time?: string;
}

export async function saveReceivingActuals(
  voucherId: string,
  data: SaveActualsPayload,
) {
  return importVoucherApi(`/${voucherId}/actuals`, "PUT", data);
}
