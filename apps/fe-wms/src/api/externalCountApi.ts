import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/external/count${path}`, {
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

export type ExternalCountSession = {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_location_id: string;
  count_purpose: "EXTERNAL_OPENING" | "EXTERNAL_CLOSING";
  status: string;
  business_date: string;
  blind_count_enabled: boolean;
  external_operator_name?: string | null;
  notes?: string | null;
  discrepancy_count?: number;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  location_name?: string | null;
  location_code?: string | null;
  counter_name?: string | null;
  cancel_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ExternalCountItem = {
  id: string;
  product_id: string;
  product_name?: string | null;
  product_barcode?: string | null;
  product_code?: string | null;
  product_unit?: string | null;
  product_image_url?: string | null;
  atp_snapshot: number;
  expected_at_count_time?: number | null;
  current_atp?: number | null;
  counted_quantity: number | null;
  discrepancy: number;
  condition: string;
  has_discrepancy: boolean;
  notes?: string | null;
};

export type ExternalCountDetail = {
  session: ExternalCountSession;
  items: ExternalCountItem[];
};

export const externalCountApi = {
  list: (params?: {
    warehouse_id?: string;
    warehouse_location_id?: string;
    status?: string;
    business_date?: string;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {}).filter(([, value]) => Boolean(value)),
      ) as Record<string, string>,
    ).toString();
    return apiFetch<{ success: boolean; data: ExternalCountSession[] }>(
      `/${query ? `?${query}` : ""}`,
    );
  },

  create: (data: {
    warehouse_id: string;
    warehouse_location_id: string;
    count_purpose: "EXTERNAL_OPENING" | "EXTERNAL_CLOSING";
    business_date: string;
    blind_count_enabled: boolean;
    external_operator_name?: string | null;
    notes?: string | null;
  }) =>
    apiFetch<{ success: boolean; data: ExternalCountDetail }>("/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: string) =>
    apiFetch<{ success: boolean; data: ExternalCountDetail }>(`/${id}`),

  updateItem: (
    sessionId: string,
    itemId: string,
    data: { counted_quantity: number; condition: string; notes?: string | null },
  ) =>
    apiFetch<{ success: boolean; data: ExternalCountDetail }>(
      `/${sessionId}/items/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    ),

  submit: (id: string) =>
    apiFetch<{ success: boolean; data: ExternalCountDetail }>(`/${id}/submit`, {
      method: "POST",
    }),

  cancel: (id: string, reason: string) =>
    apiFetch<{ success: boolean; data: ExternalCountDetail }>(`/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

