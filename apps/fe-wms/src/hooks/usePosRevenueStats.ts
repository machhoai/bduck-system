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
  warehouseIds: readonly string[],
  filter: RevenueDashboardFilter,
) {
  const warehouseKey = [...new Set(warehouseIds.filter(Boolean))]
    .sort()
    .join("|");
  const normalizedWarehouseIds = useMemo(
    () => (warehouseKey ? warehouseKey.split("|") : []),
    [warehouseKey],
  );
  const [data, setData] = useState<PosRevenueStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(normalizedWarehouseIds.length > 0);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => normalizeRange(filter), [filter]);

  useEffect(() => {
    if (normalizedWarehouseIds.length === 0) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setData(null);
    setLoading(true);
    setError(null);
    let unsubscribeOrders: Array<() => void> = [];
    let disposed = false;
    let failed = false;
    const recordsByWarehouse = new Map<string, PosRevenueOrderRecord[]>();
    const loadedWarehouses = new Set<string>();

    const emitAggregate = () => {
      if (
        disposed ||
        failed ||
        loadedWarehouses.size !== normalizedWarehouseIds.length
      ) {
        return;
      }
      const records = normalizedWarehouseIds.flatMap(
        (warehouseId) => recordsByWarehouse.get(warehouseId) ?? [],
      );
      const generatedAt = new Date().toISOString();
      const warehouseScopeId =
        normalizedWarehouseIds.length === 1
          ? normalizedWarehouseIds[0]
          : "ALL";
      setData({
        ...aggregatePosRevenueStats(records),
        generatedAt,
        dashboard: buildPosRevenueDashboardData({
          records,
          warehouseId: warehouseScopeId,
          filter,
          range,
          generatedAt,
        }),
      });
      setLoading(false);
      setError(null);
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeOrders.forEach((unsubscribe) => unsubscribe());
      unsubscribeOrders = [];
      recordsByWarehouse.clear();
      loadedWarehouses.clear();
      failed = false;
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }

      const { startIso, endExclusiveIso } = toVietnamIsoRange(range);
      unsubscribeOrders = normalizedWarehouseIds.map((warehouseId) => {
        const ordersQuery = query(
          collection(db, "pos_orders"),
          where("warehouseId", "==", warehouseId),
          where("paidAt", ">=", startIso),
          where("paidAt", "<", endExclusiveIso),
        );

        return onSnapshot(
          ordersQuery,
          (snapshot) => {
            if (disposed) return;
            recordsByWarehouse.set(
              warehouseId,
              snapshot.docs.map((document) => ({
                id: document.id,
                ...document.data(),
                warehouseId,
              })),
            );
            loadedWarehouses.add(warehouseId);
            emitAggregate();
          },
          (snapshotError) => {
            if (disposed) return;
            failed = true;
            setError(snapshotError.message);
            setLoading(false);
          },
        );
      });
    });

    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribeOrders.forEach((unsubscribe) => unsubscribe());
    };
  }, [filter, normalizedWarehouseIds, range]);

  return { data, loading, error };
}
