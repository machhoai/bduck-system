"use client";

import {
  ALL_REVENUE_WAREHOUSES,
  type RevenueDashboardData,
  type RevenueDashboardFilter,
  type RevenueProductGroups,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { auth, db } from "@/lib/firebase";
import {
  buildPosRevenueDashboardData,
  toVietnamIsoRange,
  type PosRevenueOrderRecord,
} from "@/utils/posRevenueStats";

import { normalizeRevenueRange } from "./revenueDashboardDateUtils";

interface PeriodSelection {
  warehouseIds: string[];
  filters: RevenueDashboardFilter[];
}

const EMPTY_GROUPS: RevenueProductGroups = {};

export function usePosRevenuePeriods(
  warehouseIds: readonly string[],
  filters: RevenueDashboardFilter[],
  catalog: RevenueProductGroups = EMPTY_GROUPS,
) {
  const selectionKey = JSON.stringify({
    warehouseIds: [...new Set(warehouseIds.filter(Boolean))].sort(),
    filters,
  });
  const selection = useMemo(
    () => JSON.parse(selectionKey) as PeriodSelection,
    [selectionKey],
  );
  const enabled =
    selection.warehouseIds.length > 0 && selection.filters.length > 0;
  const [state, setState] = useState({
    key: "",
    data: [] as RevenueDashboardData[],
    loading: enabled,
    error: null as string | null,
  });

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let generation = 0;
    let subscriptions: Array<() => void> = [];
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const currentGeneration = ++generation;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions = [];
      setState({
        key: selectionKey,
        data: [],
        loading: Boolean(user),
        error: null,
      });
      if (!user) return;
      const recordsByQuery = new Map<string, PosRevenueOrderRecord[]>();
      let failed = false;
      const emit = () => {
        if (
          disposed ||
          failed ||
          generation !== currentGeneration ||
          recordsByQuery.size !==
            selection.filters.length * selection.warehouseIds.length
        )
          return;
        const generatedAt = new Date().toISOString();
        const data = selection.filters.map((filter, index) =>
          buildPosRevenueDashboardData({
            records: selection.warehouseIds.flatMap(
              (id) => recordsByQuery.get(`${index}:${id}`) ?? [],
            ),
            warehouseId:
              selection.warehouseIds.length === 1
                ? selection.warehouseIds[0]
                : ALL_REVENUE_WAREHOUSES,
            filter,
            range: normalizeRevenueRange(filter),
            generatedAt,
            catalog,
          }),
        );
        setState({ key: selectionKey, data, loading: false, error: null });
      };
      selection.filters.forEach((filter, index) => {
        const { startIso, endExclusiveIso } = toVietnamIsoRange(
          normalizeRevenueRange(filter),
        );
        selection.warehouseIds.forEach((warehouseId) => {
          subscriptions.push(
            onSnapshot(
              query(
                collection(db, "pos_orders"),
                where("warehouseId", "==", warehouseId),
                where("paidAt", ">=", startIso),
                where("paidAt", "<", endExclusiveIso),
              ),
              (snapshot) => {
                if (disposed || generation !== currentGeneration) return;
                recordsByQuery.set(
                  `${index}:${warehouseId}`,
                  snapshot.docs.map((document) => ({
                    ...document.data(),
                    id: document.id,
                    warehouseId,
                  })),
                );
                emit();
              },
              (error) => {
                if (disposed || generation !== currentGeneration) return;
                failed = true;
                console.error("[usePosRevenuePeriods] snapshot error:", error);
                setState({
                  key: selectionKey,
                  data: [],
                  loading: false,
                  error: error.message,
                });
              },
            ),
          );
        });
      });
    });
    return () => {
      disposed = true;
      generation += 1;
      unsubscribeAuth();
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [catalog, enabled, selection, selectionKey]);

  // Do not render a previous store's data while the new scope is subscribing.
  const current = enabled && state.key === selectionKey;
  return {
    data: current ? state.data : [],
    loading: enabled && (!current || state.loading),
    error: current ? state.error : null,
  };
}
