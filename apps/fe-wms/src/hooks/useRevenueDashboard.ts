"use client";

import type {
  RevenueDashboardData,
  RevenueDashboardFilter,
  RevenueDataSource,
  RevenueOrderItem,
  SoldOrderGoodsItem,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { auth, db } from "@/lib/firebase";

import {
  fetchRevenueDashboard,
  getRevenueDashboardErrorMessage,
} from "./revenueDashboardApi";
import {
  buildRevenueDashboardQuery,
  DEFAULT_REVENUE_WAREHOUSE_ID,
  getRevenueDashboardCacheKey,
} from "./revenueDashboardFilters";

const REFRESH_SECONDS = 60;
const REFRESH_MS = REFRESH_SECONDS * 1000;

interface FirestoreDashboardDoc {
  dashboard?: RevenueDashboardData;
  sync_time?: Timestamp | null;
}

interface UseRevenueDashboardOptions {
  enabled?: boolean;
  warehouseId?: string;
  keepPreviousData?: boolean;
  source?: RevenueDataSource;
}

export type {
  DeviceConsumptionItem,
  PaymentMethodMetric,
  RevenueChartPoint,
  RevenueDashboardData,
  RevenueDashboardFilter,
  RevenueDataSource,
  RevenueDateMode,
  RevenueMetric,
  RevenueOrderItem,
  RevenuePaymentCategory,
  SoldOrderGoodsItem,
  TopProductGroup,
} from "@bduck/shared-types";
export {
  buildRevenueComparisonFilter,
  buildRevenueComparisonFilters,
  getDefaultRevenueComparison,
  getDefaultRevenueFilter,
  getRevenueComparisonLabel,
  getRevenueComparisonLabels,
  type RevenueCompareMode,
  type RevenueComparisonSelection,
} from "./revenueDashboardFilters";
export { useRevenueDashboardComparisons } from "./useRevenueDashboardComparisons";

export function useRevenueDashboard(
  filter: RevenueDashboardFilter,
  options: UseRevenueDashboardOptions = {},
) {
  const enabled = options.enabled ?? true;
  const keepPreviousData = options.keepPreviousData ?? false;
  const warehouseId = options.warehouseId || DEFAULT_REVENUE_WAREHOUSE_ID;
  const source = options.source ?? "OPEN_API";
  const [dashboard, setDashboard] = useState<RevenueDashboardData | null>(null);
  const [orders, setOrders] = useState<RevenueOrderItem[]>([]);
  const [soldItems, setSoldItems] = useState<SoldOrderGoodsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_SECONDS);
  const latestDataRef = useRef<RevenueDashboardData | null>(null);
  const syncingRef = useRef<string | null>(null);
  const cacheKey = useMemo(
    () => getRevenueDashboardCacheKey(filter, warehouseId, source),
    [filter, source, warehouseId],
  );
  const data = useMemo<RevenueDashboardData | null>(
    () => (dashboard ? { ...dashboard, orders, soldItems } : null),
    [dashboard, orders, soldItems],
  );

  const loadData = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      if (!enabled || syncingRef.current === cacheKey) return false;
      syncingRef.current = cacheKey;
      setSyncing(true);
      setError(null);
      let succeeded = false;
      try {
        const query = buildRevenueDashboardQuery(filter, warehouseId, source);
        await fetchRevenueDashboard(query, signal);
        succeeded = true;
        return true;
      } catch (cause) {
        if (signal?.aborted || (cause as Error).name === "AbortError") return false;
        setError(getRevenueDashboardErrorMessage(cause));
        return false;
      } finally {
        if (syncingRef.current === cacheKey) {
          syncingRef.current = null;
          setSyncing(false);
          if (!succeeded && !latestDataRef.current && !signal?.aborted) {
            setLoading(false);
          }
        }
      }
    },
    [cacheKey, enabled, filter, source, warehouseId],
  );

  useEffect(() => {
    if (!enabled || nextRefreshAt === null) {
      setSecondsUntilRefresh(REFRESH_SECONDS);
      return;
    }
    const controller = new AbortController();
    let triggered = false;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((nextRefreshAt - Date.now()) / 1000),
      );
      setSecondsUntilRefresh(remaining);
      if (remaining > 0 || triggered) return;
      triggered = true;
      void loadData(controller.signal).finally(() => {
        if (!controller.signal.aborted) {
          setNextRefreshAt((current) =>
            current === nextRefreshAt ? Date.now() + REFRESH_MS : current,
          );
        }
      });
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, loadData, nextRefreshAt]);

  useEffect(() => {
    if (!enabled) {
      resetDashboardState();
      return;
    }
    setNextRefreshAt(null);
    setSecondsUntilRefresh(REFRESH_SECONDS);
    if (!keepPreviousData || !latestDataRef.current) {
      latestDataRef.current = null;
      setDashboard(null);
      setOrders([]);
      setSoldItems([]);
      setLoading(true);
    } else {
      setLoading(false);
      setSyncing(true);
    }
    setError(null);

    let unsubscribeSnapshot: (() => void) | undefined;
    let unsubscribeOrders: (() => void) | undefined;
    let unsubscribeSoldItems: (() => void) | undefined;
    let disposed = false;
    let authGeneration = 0;
    const controller = new AbortController();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const generation = ++authGeneration;
      unsubscribeSnapshot?.();
      unsubscribeOrders?.();
      unsubscribeSoldItems?.();
      unsubscribeSnapshot = undefined;
      unsubscribeOrders = undefined;
      unsubscribeSoldItems = undefined;
      if (!user) {
        resetDashboardState();
        return;
      }

      const dashboardRef = doc(db, "revenue_dashboards", cacheKey);
      const subscribe = () => {
        unsubscribeSnapshot = onSnapshot(
          dashboardRef,
          (snapshot) => {
            if (disposed || generation !== authGeneration) return;
            if (!snapshot.exists()) {
              setNextRefreshAt(null);
              void loadData(controller.signal);
              return;
            }
            const snapshotData = snapshot.data() as FirestoreDashboardDoc;
            const nextDashboard = snapshotData.dashboard ?? null;
            const syncTime = snapshotData.sync_time?.toDate?.() ?? null;
            latestDataRef.current = nextDashboard;
            setDashboard(nextDashboard);
            setLoading(false);
            setSyncing(false);
            setError(null);
            setNextRefreshAt(syncTime ? syncTime.getTime() + REFRESH_MS : Date.now());
            if (!unsubscribeOrders) {
              unsubscribeOrders = subscribeRows<RevenueOrderItem>(
                cacheKey,
                "orders",
                generation,
                () => authGeneration,
                () => disposed,
                setOrders,
              );
            }
            if (!unsubscribeSoldItems) {
              unsubscribeSoldItems = subscribeRows<SoldOrderGoodsItem>(
                cacheKey,
                "sold_items",
                generation,
                () => authGeneration,
                () => disposed,
                setSoldItems,
              );
            }
          },
          (snapshotError) => {
            console.warn("[useRevenueDashboard] onSnapshot error:", snapshotError);
            setError(snapshotError.message);
            setLoading(false);
            setSyncing(false);
          },
        );
      };

      void loadData(controller.signal).then((ready) => {
        if (
          ready &&
          !disposed &&
          !controller.signal.aborted &&
          generation === authGeneration
        ) {
          subscribe();
        }
      });
    });

    return () => {
      disposed = true;
      authGeneration += 1;
      controller.abort();
      unsubscribeAuth();
      unsubscribeSnapshot?.();
      unsubscribeOrders?.();
      unsubscribeSoldItems?.();
    };

    function resetDashboardState() {
      latestDataRef.current = null;
      setDashboard(null);
      setOrders([]);
      setSoldItems([]);
      setLoading(false);
      setSyncing(false);
      setError(null);
      setNextRefreshAt(null);
    }
  }, [cacheKey, enabled, keepPreviousData, loadData]);

  return { data, loading, syncing, error, cacheKey, secondsUntilRefresh };
}

function subscribeRows<T extends { createTime: string }>(
  cacheKey: string,
  collectionName: string,
  generation: number,
  currentGeneration: () => number,
  isDisposed: () => boolean,
  update: (rows: T[]) => void,
) {
  return onSnapshot(
    collection(db, "revenue_dashboards", cacheKey, collectionName),
    (snapshot) => {
      if (isDisposed() || generation !== currentGeneration()) return;
      update(
        snapshot.docs
          .map((item) => item.data() as T & { is_deleted?: boolean })
          .filter((item) => !item.is_deleted)
          .sort((left, right) => right.createTime.localeCompare(left.createTime)),
      );
    },
  );
}
