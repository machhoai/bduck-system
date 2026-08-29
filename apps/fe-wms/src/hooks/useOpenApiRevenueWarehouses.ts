"use client";

import { useEffect, useState } from "react";

import { getDetailedErrorMessage } from "@/utils/apiError";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiResponse {
  success?: boolean;
  data?: string[];
  messages?: { vi?: string; zh?: string };
}

export function useOpenApiRevenueWarehouses() {
  const [warehouseIds, setWarehouseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void authenticatedFetch(
      `${API_BASE_URL}/api/revenue/openapi-warehouses`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | ApiResponse
          | null;
        if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
          throw new Error(
            payload?.messages?.vi ??
              "Không thể tải danh sách cửa hàng OpenAPI.",
          );
        }
        setWarehouseIds(payload.data);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setWarehouseIds([]);
        setError(
          getDetailedErrorMessage(
            requestError,
            "Không thể tải danh sách cửa hàng OpenAPI.",
          ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { warehouseIds, loading, error };
}
