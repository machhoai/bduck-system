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

export type ExternalCountCheckpointType = "BEFORE_SCAN" | "BEFORE_SUBMIT";

export type ExternalCountSession = {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_location_id: string;
  checkpoint_type?: ExternalCountCheckpointType;
  count_purpose?: "EXTERNAL_OPENING" | "EXTERNAL_CLOSING";
  status: string;
  business_date: string;
  external_operator_name?: string | null;
  external_operator_id?: string | null;
  external_client_id?: string | null;
  device_id?: string | null;
  idempotency_key?: string | null;
  notes?: string | null;
  discrepancy_count?: number;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  location_name?: string | null;
  location_code?: string | null;
  action_time?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  submitted_at?: unknown;
};

export type ExternalCountRequirementConfig = {
  id: string;
  enabled: boolean;
  require_before_scan: boolean;
  require_before_submit: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
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

  getRequirement: () =>
    apiFetch<{ success: boolean; data: ExternalCountRequirementConfig }>(
      "/requirement",
    ),

  updateRequirement: (data: {
    enabled: boolean;
    require_before_scan: boolean;
    require_before_submit: boolean;
  }) =>
    apiFetch<{ success: boolean; data: ExternalCountRequirementConfig }>(
      "/requirement",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ),
};
