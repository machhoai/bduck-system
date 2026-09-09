"use client";

import type { PosOrderSummary } from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { auth, db } from "@/lib/firebase";
import {
  DEFAULT_POS_ORDER_FILTERS,
  filterPosOrders,
  type PosOrderFiltersValue,
} from "@/utils/posOrderFilters";

const PAGE_SIZE = 30;

export function usePosOrders(warehouseId: string, canRead: boolean) {
  const [filters, setFilters] = useState<PosOrderFiltersValue>(
    DEFAULT_POS_ORDER_FILTERS,
  );
  const [pageCount, setPageCount] = useState(1);
  const [state, setState] = useState({
    key: "",
    orders: [] as PosOrderSummary[],
    hasMore: false,
    loading: canRead,
    error: null as string | null,
  });

  useEffect(() => {
    setPageCount(1);
  }, [filters.sortBy, filters.sortDir, warehouseId]);

  useEffect(() => {
    setState((current) =>
      current.key === warehouseId
        ? { ...current, loading: current.orders.length === 0, error: null }
        : {
            key: warehouseId,
            orders: [],
            hasMore: false,
            loading: canRead,
            error: null,
          },
    );
    if (!warehouseId || !canRead) return undefined;
    let disposed = false;
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user || disposed) {
        setState({
          key: warehouseId,
          orders: [],
          hasMore: false,
          loading: false,
          error: null,
        });
        return;
      }
      setState((current) => ({
        ...current,
        loading: current.orders.length === 0,
        error: null,
      }));
      unsubscribeSnapshot = onSnapshot(
        query(
          collection(db, "pos_order_summaries"),
          where("warehouseId", "==", warehouseId),
          orderBy(filters.sortBy, filters.sortDir),
          limit(PAGE_SIZE * pageCount + 1),
        ),
        (snapshot) => {
          if (disposed) return;
          setState({
            key: warehouseId,
            orders: snapshot.docs
              .slice(0, PAGE_SIZE * pageCount)
              .map((item) => ({
                ...(item.data() as Omit<PosOrderSummary, "id">),
                id: item.id,
              })),
            hasMore: snapshot.size > PAGE_SIZE * pageCount,
            loading: false,
            error: null,
          });
        },
        (error) => {
          if (disposed) return;
          console.error("[usePosOrders] snapshot error:", error);
          setState({
            key: warehouseId,
            orders: [],
            hasMore: false,
            loading: false,
            error: error.message,
          });
        },
      );
    });
    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [canRead, filters.sortBy, filters.sortDir, pageCount, warehouseId]);

  const currentOrders = useMemo(
    () => (state.key === warehouseId ? state.orders : []),
    [state.key, state.orders, warehouseId],
  );
  const orders = useMemo(
    () => filterPosOrders(currentOrders, filters),
    [currentOrders, filters],
  );
  const employeeOptions = useMemo(() => {
    const values = new Map<string, string>();
    currentOrders.forEach((order) => {
      if (order.operatorId) values.set(order.operatorId, order.operatorName);
    });
    return Array.from(values, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );
  }, [currentOrders]);

  return {
    orders,
    employeeOptions,
    filters,
    setFilters,
    loading: state.key !== warehouseId || state.loading,
    error: state.key === warehouseId ? state.error : null,
    hasMore: state.key === warehouseId && state.hasMore,
    loadMore: () => setPageCount((value) => value + 1),
  };
}
