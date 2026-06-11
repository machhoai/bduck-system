/**
 * Export Voucher API — REST helpers for export voucher operations
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/export-vouchers${path}`, {
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

/** Create new export voucher */
export async function createExportVoucher(data: Record<string, unknown>) {
  return apiFetch("/", { method: "POST", body: JSON.stringify(data) });
}

/** Save picking actuals */
export async function savePickingActuals(
  voucherId: string,
  payload: {
    items: Array<{ id: string; picked_quantity: number; notes?: string | null }>;
    action_time?: string;
  },
) {
  return apiFetch(`/${voucherId}/picking-actuals`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Complete picking → deduct ATP → advance to SHIPPED */
export async function completePicking(voucherId: string) {
  return apiFetch(`/${voucherId}/complete-picking`, { method: "POST" });
}

/** Complete export → COMPLETED */
export async function completeExportVoucher(voucherId: string) {
  return apiFetch(`/${voucherId}/complete-export`, { method: "POST" });
}

/** Fetch voucher with items */
export async function fetchExportVoucherById(voucherId: string) {
  return apiFetch(`/${voucherId}`);
}
