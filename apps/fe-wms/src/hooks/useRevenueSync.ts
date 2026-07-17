"use client";

/**
 * useRevenueSync — Real-time revenue data from Firestore
 *
 * ► onSnapshot trên `revenue_sync/{period}` → lắng nghe real-time
 * ► Khi mount → gọi BE API `/api/revenue/sync/{period}` để trigger sync
 * ► Return: { revenue, syncTime, loading, syncing }
 *
 * Tuân thủ LUẬT THÉP: dùng onSnapshot, KHÔNG dùng nút "Tải lại"
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RevenueSyncData {
  period: string;
  warehouse_id: string;
  total_revenue: number;
  shop_real_money: number;
  refund_money: number;
  daily_breakdown: Record<string, number>;
  sync_time: Date | null;
  synced_by: string;
}

interface UseRevenueSyncReturn {
  revenue: RevenueSyncData | null;
  loading: boolean;
  syncing: boolean;
  syncTime: Date | null;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useRevenueSync(
  period: string,
  warehouseId: string,
): UseRevenueSyncReturn {
  const [revenue, setRevenue] = useState<RevenueSyncData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const hasSynced = useRef(false);

  const syncingRef = useRef(false);

  // Trigger BE sync API (only once per mount/period change)
  const triggerSync = useCallback(async () => {
    if (!period || !warehouseId || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const query = new URLSearchParams({ warehouseId });
      await fetch(`${API_BASE_URL}/api/revenue/sync/${period}?${query}`, {
        method: "GET",
        credentials: "include",
      });
    } catch (err) {
      console.error("[useRevenueSync] trigger sync error:", err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [period, warehouseId]);

  useEffect(() => {
    if (!period || !warehouseId) {
      setRevenue(null);
      setLoading(false);
      return;
    }

    hasSynced.current = false;
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        setRevenue(null);
        setLoading(false);
        return;
      }

      const docRef = doc(db, "revenue_sync", `${warehouseId}_${period}`);

      unsubscribeSnapshot = onSnapshot(
        docRef,
        (snapshot) => {
          if (isDisposed) return;

          if (snapshot.exists()) {
            const data = snapshot.data();
            const syncTimestamp = data.sync_time as Timestamp | null;

            setRevenue({
              period: String(data.period || period),
              warehouse_id: String(data.warehouse_id || warehouseId),
              total_revenue: Number(data.total_revenue ?? 0),
              shop_real_money: Number(data.shop_real_money ?? 0),
              refund_money: Number(data.refund_money ?? 0),
              daily_breakdown:
                (data.daily_breakdown as Record<string, number>) || {},
              sync_time: syncTimestamp?.toDate?.() ?? null,
              synced_by: String(data.synced_by || ""),
            });
          } else {
            setRevenue(null);
          }

          setLoading(false);

          // Trigger sync on first snapshot if no data or data is old
          if (!hasSynced.current) {
            hasSynced.current = true;
            void triggerSync();
          }
        },
        (error) => {
          console.warn("[useRevenueSync] onSnapshot error:", error);
          setLoading(false);
        },
      );
    });

    return () => {
      isDisposed = true;
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [period, triggerSync, warehouseId]);

  return {
    revenue,
    loading,
    syncing,
    syncTime: revenue?.sync_time ?? null,
  };
}
