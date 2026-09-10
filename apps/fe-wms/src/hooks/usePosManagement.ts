"use client";

import type {
  PosLuckyDrawSettingsView,
  PosReceiptSettings,
  PosStoreOverview,
  PosTicketSettings,
} from "@bduck/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { posManagementApi, type SafePosDevice } from "@/api/posManagementApi";

export function usePosManagement(
  warehouseId: string,
  access: { devices: boolean; settings: boolean },
) {
  const [overview, setOverview] = useState<PosStoreOverview | null>(null);
  const [devices, setDevices] = useState<SafePosDevice[]>([]);
  const [settings, setSettings] = useState<PosReceiptSettings | null>(null);
  const [ticketSettings, setTicketSettings] =
    useState<PosTicketSettings | null>(null);
  const [luckyDrawView, setLuckyDrawView] =
    useState<PosLuckyDrawSettingsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!warehouseId) return;
    const activeRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [
        nextOverview,
        nextDevices,
        nextSettings,
        nextTicketSettings,
        nextLuckyDrawView,
      ] = await Promise.all([
        access.devices ? posManagementApi.getOverview(warehouseId) : null,
        access.devices || access.settings
          ? posManagementApi.listDevices(warehouseId)
          : [],
        access.settings
          ? posManagementApi.getReceiptSettings(warehouseId)
          : null,
        access.settings
          ? posManagementApi.getTicketSettings(warehouseId)
          : null,
        access.settings
          ? posManagementApi.getLuckyDrawSettings(warehouseId)
          : null,
      ]);
      if (requestId.current !== activeRequestId) return;
      setOverview(nextOverview);
      setDevices(nextDevices);
      setSettings(nextSettings);
      setTicketSettings(nextTicketSettings);
      setLuckyDrawView(nextLuckyDrawView);
    } catch (reason: unknown) {
      if (requestId.current !== activeRequestId) return;
      setError(
        reason instanceof Error ? reason.message : "Không thể tải dữ liệu POS.",
      );
    } finally {
      if (requestId.current === activeRequestId) setLoading(false);
    }
  }, [access.devices, access.settings, warehouseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!warehouseId || !access.settings) return;
    let disposed = false;
    const syncPrintSettings = async () => {
      try {
        const [nextSettings, nextTicketSettings, nextLuckyDrawView] =
          await Promise.all([
            posManagementApi.getReceiptSettings(warehouseId),
            posManagementApi.getTicketSettings(warehouseId),
            posManagementApi.getLuckyDrawSettings(warehouseId),
          ]);
        if (disposed) return;
        setSettings((current) =>
          current?.version === nextSettings?.version ? current : nextSettings,
        );
        setTicketSettings((current) =>
          current?.version === nextTicketSettings?.version
            ? current
            : nextTicketSettings,
        );
        setLuckyDrawView(nextLuckyDrawView);
      } catch {
        // The regular refresh flow owns visible errors; background sync stays quiet.
      }
    };
    const timer = window.setInterval(() => void syncPrintSettings(), 10_000);
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void syncPrintSettings();
    };
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [access.settings, warehouseId]);

  return {
    overview,
    devices,
    settings,
    ticketSettings,
    luckyDrawView,
    loading,
    error,
    refresh,
  };
}
