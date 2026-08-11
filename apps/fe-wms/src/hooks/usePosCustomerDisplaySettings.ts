"use client";

import type { PosCustomerDisplaySettingsView } from "@bduck/shared-types";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import { posCustomerDisplayApi } from "@/api/posCustomerDisplayApi";
import { db } from "@/lib/firebase";

export function usePosCustomerDisplaySettings(warehouseId: string, enabled: boolean) {
  const [view, setView] = useState<PosCustomerDisplaySettingsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const versionRef = useRef<number | null>(null);

  const replace = useCallback((next: PosCustomerDisplaySettingsView) => {
    versionRef.current = next.settings?.version ?? 0;
    setView(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!warehouseId || !enabled) return;
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await posCustomerDisplayApi.get(warehouseId);
      if (requestId.current === activeRequest) replace(next);
    } catch (reason) {
      if (requestId.current === activeRequest) {
        setError(reason instanceof Error ? reason.message : "Không thể tải quảng cáo.");
      }
    } finally {
      if (requestId.current === activeRequest) setLoading(false);
    }
  }, [enabled, replace, warehouseId]);

  useEffect(() => {
    versionRef.current = null;
    setView(null);
    if (!warehouseId || !enabled) return;
    void refresh();
    return onSnapshot(
      doc(db, "pos_customer_display_settings", warehouseId),
      (snapshot) => {
        const version = snapshot.exists() ? Number(snapshot.data().version ?? 0) : 0;
        if (versionRef.current !== null && versionRef.current !== version) void refresh();
      },
      () => setError("Không thể theo dõi cấu hình quảng cáo realtime."),
    );
  }, [enabled, refresh, warehouseId]);

  return { view, loading, error, refresh, replace };
}
