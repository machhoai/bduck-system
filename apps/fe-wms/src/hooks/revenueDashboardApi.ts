import type { RevenueDashboardData } from "@bduck/shared-types";

import { createDetailedApiError, getDetailedErrorMessage } from "@/utils/apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
}

export async function fetchRevenueDashboard(
  query: string,
  signal?: AbortSignal,
): Promise<RevenueDashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/revenue/dashboard?${query}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const json = (await response.json().catch(() => null)) as
    | ApiResponse<RevenueDashboardData>
    | null;
  if (!response.ok || !json?.success || !json.data) {
    throw createDetailedApiError(
      response,
      json,
      "Khong the tai dashboard doanh thu.",
    );
  }
  return json.data;
}

export function getRevenueDashboardErrorMessage(error: unknown): string {
  if (
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed/iu.test(error.message)
  ) {
    return "Không thể kết nối API doanh thu. Vui lòng kiểm tra backend hoặc NEXT_PUBLIC_API_URL.";
  }
  return getDetailedErrorMessage(error, "Khong the tai dashboard doanh thu.");
}
