"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InventoryDashboardSummary } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const DASHBOARD_TIMEOUT_MS = 10_000;
const DASHBOARD_REFRESH_MS = 60_000;

export function useInventoryDashboardSummary(warehouseId?: string) {
  const [data, setData] = useState<InventoryDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestGeneration = useRef(0);
  const dataRef = useRef<InventoryDashboardSummary | null>(null);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const hasCurrentData =
      dataRef.current?.warehouseId === (warehouseId ?? null);
    if (hasCurrentData) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set("warehouse_id", warehouseId);
      const query = params.size > 0 ? `?${params.toString()}` : "";
      const response = await fetch(
        `${API_BASE_URL}/api/dashboard/summary${query}`,
        {
          credentials: "include",
          signal: AbortSignal.timeout(DASHBOARD_TIMEOUT_MS),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw createDetailedApiError(
          response,
          body,
          "Không thể tải dữ liệu dashboard.",
        );
      }
      if (generation !== requestGeneration.current) return;
      const nextData = body.data as InventoryDashboardSummary;
      dataRef.current = nextData;
      setData(nextData);
      setError(null);
    } catch (loadError) {
      if (generation !== requestGeneration.current) return;
      setError(
        loadError instanceof Error
          ? loadError
          : new Error("Không thể tải dữ liệu dashboard."),
      );
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [warehouseId]);

  useEffect(() => {
    if (dataRef.current?.warehouseId !== (warehouseId ?? null)) {
      dataRef.current = null;
      setData(null);
    }
    void load();

    const unsubscribeMutation = subscribeDataMutation(
      ["inventory", "products", "warehouses"],
      () => void load(),
    );
    const refreshTimer = window.setInterval(
      () => void load(),
      DASHBOARD_REFRESH_MS,
    );
    const handleOnline = () => void load();
    window.addEventListener("online", handleOnline);
    return () => {
      requestGeneration.current += 1;
      unsubscribeMutation();
      window.clearInterval(refreshTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, [load, warehouseId]);

  return { data, loading, refreshing, error, retry: load };
}
