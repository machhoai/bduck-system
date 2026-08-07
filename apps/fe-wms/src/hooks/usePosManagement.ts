"use client";

import type { PosPaymentSettings, PosReceiptSettings, PosStoreOverview } from "@bduck/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  posManagementApi,
  type SafePosDevice,
} from "@/api/posManagementApi";

export function usePosManagement(
  warehouseId: string,
  access: { devices: boolean; settings: boolean },
) {
  const [overview, setOverview] = useState<PosStoreOverview | null>(null);
  const [devices, setDevices] = useState<SafePosDevice[]>([]);
  const [settings, setSettings] = useState<PosReceiptSettings | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PosPaymentSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!warehouseId) return;
    const activeRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextDevices, nextSettings, nextPaymentSettings] = await Promise.all([
        access.devices ? posManagementApi.getOverview(warehouseId) : null,
        access.devices ? posManagementApi.listDevices(warehouseId) : [],
        access.settings ? posManagementApi.getReceiptSettings(warehouseId) : null,
        access.settings ? posManagementApi.getPaymentSettings(warehouseId) : null,
      ]);
      if (requestId.current !== activeRequestId) return;
      setOverview(nextOverview);
      setDevices(nextDevices);
      setSettings(nextSettings);
      setPaymentSettings(nextPaymentSettings);
    } catch (reason: unknown) {
      if (requestId.current !== activeRequestId) return;
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu POS.");
    } finally {
      if (requestId.current === activeRequestId) setLoading(false);
    }
  }, [access.devices, access.settings, warehouseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { overview, devices, settings, paymentSettings, loading, error, refresh };
}
