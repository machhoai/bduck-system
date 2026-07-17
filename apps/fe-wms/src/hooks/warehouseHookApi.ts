import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiCollectionResponse<T> = {
  success?: boolean;
  data?: T[];
  messages?: { vi?: string; zh?: string };
};

export async function fetchWarehouseCollection<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = (await response
    .json()
    .catch(() => null)) as ApiCollectionResponse<T> | null;
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the tai du lieu kho.");
  }
  return body.data || [];
}

export async function callWarehouseApi(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  payload?: unknown,
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the luu du lieu kho.");
  }
  return body;
}
