/**
 * Transfer Order API — REST helpers for transfer order operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

  const json = await response.json();
  if (!response.ok) {
    const err = new Error(json.messages?.vi || "API Error") as Error & {
      statusCode: number;
      messages: Record<string, string>;
    };
    err.statusCode = response.status;
    err.messages = json.messages || {};
    throw err;
  }
  return json.data as T;
}

/** Create new transfer order */
export async function createTransferOrder(data: Record<string, unknown>) {
  return apiFetch("/", { method: "POST", body: JSON.stringify(data) });
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
