"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import type {
  RevenueDashboardData,
  RevenueDashboardFilter,
} from "@/hooks/useRevenueDashboard";
import { auth, db } from "@/lib/firebase";
import {
  aggregatePosRevenueStats,
  buildPosRevenueDashboardData,
  toVietnamIsoRange,
  type PosRevenueOrderRecord,
  type PosRevenueStats,
} from "@/utils/posRevenueStats";

interface PosRevenueStatsSnapshot extends PosRevenueStats {
  generatedAt: string;
  dashboard: RevenueDashboardData;
}

const normalizeRange = (
  filter: RevenueDashboardFilter,
): { startDate: string; endDate: string } => {
  if (filter.mode === "month") {
    const startDate = `${filter.month}-01`;
    const [year, month] = filter.month.split("-").map(Number);
    const endDate = new Date(Date.UTC(year, month, 0))
      .toISOString()
      .slice(0, 10);
    return { startDate, endDate };
  }
  if (filter.mode === "year") {
    return {
      startDate: `${filter.year}-01-01`,
      endDate: `${filter.year}-12-31`,
    };
  }
  if (filter.mode === "custom") {
    return filter.startDate <= filter.endDate
      ? { startDate: filter.startDate, endDate: filter.endDate }
      : { startDate: filter.endDate, endDate: filter.startDate };
  }
  return { startDate: filter.date, endDate: filter.date };
};

export function usePosRevenueStats(
  warehouseId: string | undefined,
  filter: RevenueDashboardFilter,
) {
  const [data, setData] = useState<PosRevenueStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(warehouseId));
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => normalizeRange(filter), [filter]);

  useEffect(() => {
    if (!warehouseId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    let unsubscribeOrders: (() => void) | undefined;
    let disposed = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeOrders) {
        unsubscribeOrders();
        unsubscribeOrders = undefined;
      }
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }

      const { startIso, endExclusiveIso } = toVietnamIsoRange(range);
      const ordersQuery = query(
        collection(db, "pos_orders"),
        where("warehouseId", "==", warehouseId),
        where("paidAt", ">=", startIso),
        where("paidAt", "<", endExclusiveIso),
      );

      unsubscribeOrders = onSnapshot(
        ordersQuery,
        (snapshot) => {
          if (disposed) return;
          const records: PosRevenueOrderRecord[] = snapshot.docs.map(
            (document) => ({ id: document.id, ...document.data() }),
          );
          const generatedAt = new Date().toISOString();
          setData({
            ...aggregatePosRevenueStats(records),
            generatedAt,
            dashboard: buildPosRevenueDashboardData({
              records,
              warehouseId,
              filter,
              range,
              generatedAt,
            }),
          });
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          if (disposed) return;
          setError(snapshotError.message);
          setLoading(false);
        },
      );
    });

    return () => {
      disposed = true;
      unsubscribeAuth();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [filter, range, warehouseId]);

  return { data, loading, error };
}
