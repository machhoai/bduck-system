import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type StockCountScope = "WAREHOUSE" | "LOCATION" | "CATEGORY" | "PRODUCT";
export type StockCountStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "DISCREPANCY_FOUND"
  | "VERIFIED"
  | "RESOLVED"
  | "CANCELLED";

export type StockCountSessionRow = {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_location_id?: string | null;
  count_scope?: StockCountScope;
  criteria?: {
    warehouse_location_ids?: string[];
    product_ids?: string[];
    category_id?: string | null;
  } | null;
  status: StockCountStatus;
  created_by?: string | null;
  counter_id?: string | null;
  discrepancy_count?: number;
  notes?: string | null;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  location_name?: string | null;
  location_code?: string | null;
  started_at?: unknown;
  submitted_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type StockCountItemRow = {
  id: string;
  session_id: string;
  inventory_id?: string | null;
  product_id: string;
  warehouse_location_id: string;
  system_quantity: number;
  atp_snapshot: number;
  counted_quantity: number | null;
  counted_at?: unknown;
  discrepancy: number;
  condition: "GOOD" | "DAMAGED" | "EXPIRED" | "MISSING";
  has_discrepancy: boolean;
  recount_count?: number;
  discrepancy_reason?: string | null;
  discrepancy_note?: string | null;
  evidence_urls?: string[];
  notes?: string | null;
  product_name?: string | null;
  product_code?: string | null;
  product_barcode?: string | null;
  product_unit?: string | null;
  product_image_url?: string | null;
  location_name?: string | null;
  location_code?: string | null;
  location_type?: string | null;
};

export type StockCountDetail = {
  session: StockCountSessionRow;
  items: StockCountItemRow[];
};

export type CreateStockCountPayload = {
  warehouse_id: string;
  count_scope: StockCountScope;
  warehouse_location_ids?: string[];
  product_ids?: string[];
  category_id?: string | null;
  notes?: string | null;
  blind_count_enabled?: boolean;
  action_time: string;
};

export type UpdateStockCountItemPayload = {
  counted_quantity: number;
  condition: StockCountItemRow["condition"];
  evidence_urls: string[];
  discrepancy_reason?: string | null;
  discrepancy_note?: string | null;
  notes?: string | null;
  action_time: string;
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/stock-counts${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw createDetailedApiError(response, body, `API Error: ${response.status}`);
  }
  return body;
}

export const stockCountApi = {
  list: (params?: {
    warehouse_id?: string;
    warehouse_location_id?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {}).filter(([, value]) => Boolean(value)),
      ) as Record<string, string>,
    ).toString();
    return apiFetch<{ success: boolean; data: StockCountSessionRow[] }>(
      `/${query ? `?${query}` : ""}`,
    );
  },
  get: (id: string) =>
    apiFetch<{ success: boolean; data: StockCountDetail }>(`/${id}`),
  create: (payload: CreateStockCountPayload) =>
    apiFetch<{ success: boolean; data: StockCountDetail }>("/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateItem: (sessionId: string, itemId: string, payload: UpdateStockCountItemPayload) =>
    apiFetch<{ success: boolean; data: StockCountDetail }>(`/${sessionId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  submit: (sessionId: string) =>
    apiFetch<{ success: boolean; data: StockCountDetail }>(`/${sessionId}/submit`, {
      method: "POST",
      body: JSON.stringify({ action_time: new Date().toISOString() }),
    }),
  cancel: (sessionId: string, reason: string) =>
    apiFetch<{ success: boolean; data: StockCountDetail }>(`/${sessionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason, action_time: new Date().toISOString() }),
    }),
};
