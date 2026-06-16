/**
 * Transfer Order API — REST helpers for transfer order operations
 */

import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/transfer-orders${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw createDetailedApiError(response, json, "Khong the xu ly lenh chuyen kho.");
  }
  return json?.data as T;
}

/** Create new transfer order */
export async function createTransferOrder(data: Record<string, unknown>) {
  return apiFetch("/", { method: "POST", body: JSON.stringify(data) });
}

/** Update an editable transfer order */
export async function updateTransferOrder(id: string, data: Record<string, unknown>) {
  return apiFetch(`/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

/** Manual 1-click: create export voucher from transfer */
export async function createExportFromTransfer(
  orderId: string,
  additionalAttachmentUrls: string[] = [],
) {
  return apiFetch(`/${orderId}/create-export`, {
    method: "POST",
    body: JSON.stringify({ additional_attachment_urls: additionalAttachmentUrls }),
  });
}

/** Start receiving */
export async function startReceiving(orderId: string) {
  return apiFetch(`/${orderId}/receive`, { method: "POST" });
}

/** Complete receiving with items */
export async function completeReceiving(
  orderId: string,
  items: Array<{
    item_id: string;
    destination_location_id: string;
    received_quantity: number;
  }>,
) {
  return apiFetch(`/${orderId}/complete-receiving`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

/** Fetch transfer order with items */
export async function fetchTransferOrderById(orderId: string) {
  return apiFetch(`/${orderId}`);
}
