/**
 * Expense API — REST helpers for expense operations
 */

import { emitDataMutation } from "@/lib/dataInvalidation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
};

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/expenses${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  });

  const json = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !json?.success) {
    const err = new Error(
      json?.messages?.vi || "Không thể xử lý phản hồi từ máy chủ.",
    ) as Error & {
      statusCode: number;
      messages: Record<string, string>;
    };
    err.statusCode = response.status;
    err.messages = json?.messages || {};
    throw err;
  }

  if (method !== "GET") {
    emitDataMutation(["audit_logs"]);
  }

  return json.data as T;
}

/** Fetch expense data for a warehouse + period */
export async function fetchExpenseData(warehouseId: string, period: string) {
  return apiFetch(`/${warehouseId}/${period}`);
}

/** Update a single expense item by category */
export async function updateExpenseItemApi(
  warehouseId: string,
  period: string,
  category: string,
  data: Record<string, unknown>,
) {
  return apiFetch(`/${warehouseId}/${period}/items/${category}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Close the accounting period */
export async function closePeriodApi(warehouseId: string, period: string) {
  return apiFetch(`/${warehouseId}/${period}/close`, { method: "POST" });
}

/** Reopen a previously closed accounting period */
export async function reopenPeriodApi(warehouseId: string, period: string) {
  return apiFetch(`/${warehouseId}/${period}/reopen`, { method: "POST" });
}

/** Fetch dashboard KPI metrics */
export async function fetchDashboardMetrics(
  warehouseId: string,
  period: string,
) {
  return apiFetch(`/dashboard/${warehouseId}/${period}`);
}

/** Save or update a custom expense item */
export async function saveCustomExpenseItem(
  warehouseId: string,
  period: string,
  itemId: string,
  data: {
    label: string;
    cost_center: string;
    actual_amount: number;
    budget_amount: number | null;
    note?: string | null;
  },
) {
  return apiFetch(`/${warehouseId}/${period}/custom-items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Soft-delete a custom expense item (is_deleted: true) */
export async function deleteCustomExpenseItem(
  warehouseId: string,
  period: string,
  itemId: string,
) {
  return apiFetch(`/${warehouseId}/${period}/custom-items/${itemId}`, {
    method: "DELETE",
  });
}
