"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpenApiWarehouseConfig } from "@bduck/shared-types";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
};

export type OpenApiConfigPayload = {
  app_id: string;
  secret_key?: string;
  base_url: string;
  api_version: string;
  action_versions: Record<string, string>;
  enabled: boolean;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !json?.success) {
    throw createDetailedApiError(response, json, fallback);
  }
  return json.data as T;
}

export function useOpenApiConfig(warehouseId?: string) {
  const [config, setConfig] = useState<OpenApiWarehouseConfig | null>(null);
  const [loading, setLoading] = useState(Boolean(warehouseId));
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!warehouseId) {
      setConfig(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/system-configs/openapi/${warehouseId}`,
      );
      const data = await readJson<OpenApiWarehouseConfig | null>(
        response,
        "Khong the tai cau hinh OpenAPI.",
      );
      setConfig(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Khong the tai cau hinh OpenAPI.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  const saveConfig = useCallback(
    async (payload: OpenApiConfigPayload) => {
      if (!warehouseId) throw new Error("Chua chon cua hang.");
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/system-configs/openapi/${warehouseId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await readJson<OpenApiWarehouseConfig>(
        response,
        "Khong the luu cau hinh OpenAPI.",
      );
      setConfig(data);
      return data;
    },
    [warehouseId],
  );

  const testConfig = useCallback(async () => {
    if (!warehouseId) throw new Error("Chua chon cua hang.");
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/system-configs/openapi/${warehouseId}/test`,
      { method: "POST" },
    );
    return readJson<unknown>(response, "Khong the ket noi OpenAPI.");
  }, [warehouseId]);

  useEffect(() => {
    void loadConfig().catch(() => undefined);
  }, [loadConfig]);

  return { config, loading, error, reload: loadConfig, saveConfig, testConfig };
}
