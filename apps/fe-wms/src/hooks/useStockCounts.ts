"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { useUserStore } from "@/stores/useUserStore";
import {
  stockCountApi,
  type CreateStockCountPayload,
  type StockCountDetail,
  type StockCountSessionRow,
  type UpdateStockCountItemPayload,
} from "@/api/stockCountApi";

const STOCK_COUNT_ACCESS_PERMISSIONS = [
  "stock_counts.view",
  "stock_counts.create",
  "stock_counts.count",
  "external_count.view",
  "external_count.count",
];

function toTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof timestamp.toDate === "function")
      return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    if (typeof timestamp._seconds === "number")
      return timestamp._seconds * 1000;
  }
  const parsed = new Date(value as string | number).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getAccessibleWarehouseIds(
  permissions: Record<string, Record<string, unknown>>,
) {
  const globalPerms = permissions.global || {};
  if (
    globalPerms["*"] === true ||
    STOCK_COUNT_ACCESS_PERMISSIONS.some((key) => globalPerms[key] === true)
  ) {
    return { isGlobal: true, ids: [] as string[] };
  }
  return {
    isGlobal: false,
    ids: Object.entries(permissions)
      .filter(
        ([scope, scoped]) =>
          scope !== "global" &&
          (scoped["*"] === true ||
            STOCK_COUNT_ACCESS_PERMISSIONS.some((key) => scoped[key] === true)),
      )
      .map(([scope]) => scope),
  };
}

export function useStockCounts(options: { warehouseId?: string } = {}) {
  const permissions = useUserStore((state) => state.permissions);
  const accessibleWarehouseIds = useMemo(
    () => getAccessibleWarehouseIds(permissions),
    [permissions],
  );
  const [sessions, setSessions] = useState<StockCountSessionRow[]>([]);
  const [detail, setDetail] = useState<StockCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const applyRows = useCallback(
    (rows: StockCountSessionRow[]) => {
      const scoped = accessibleWarehouseIds.isGlobal
        ? rows
        : rows.filter((row) =>
            accessibleWarehouseIds.ids.includes(row.warehouse_id),
          );
      setSessions(
        scoped
          .filter(
            (row) =>
              !options.warehouseId || row.warehouse_id === options.warehouseId,
          )
          .sort((a, b) => toTime(b.created_at) - toTime(a.created_at)),
      );
    },
    [accessibleWarehouseIds, options.warehouseId],
  );

  const loadFallback = useCallback(async () => {
    try {
      const response = await stockCountApi.list({
        warehouse_id: options.warehouseId,
      });
      applyRows(response.data || []);
      setError(null);
    } catch (fallbackError) {
      const nextError =
        fallbackError instanceof Error
          ? fallbackError
          : new Error("Khong the tai phien kiem dem.");
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [applyRows, options.warehouseId]);

  useEffect(() => {
    setLoading(true);
    const unsubscribeMutation = subscribeDataMutation(
      [
        "stock_count_sessions",
        "stock_count_items",
        "nonconformity_reports",
        "inventory",
      ],
      () => void loadFallback(),
    );

    const stockCountQuery = query(
      collection(db, "stock_count_sessions"),
      where("source", "==", "INTERNAL_UI"),
      where("is_deleted", "==", false),
    );

    const unsubscribe = onSnapshot(
      stockCountQuery,
      (snapshot) => {
        applyRows(
          snapshot.docs.map(
            (doc) => ({ ...doc.data(), id: doc.id }) as StockCountSessionRow,
          ),
        );
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.warn("[useStockCounts] snapshot failed", snapshotError);
        void loadFallback();
      },
    );

    return () => {
      unsubscribeMutation();
      unsubscribe();
    };
  }, [applyRows, loadFallback]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await stockCountApi.get(id);
      setDetail(response.data);
      return response.data;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (payload: CreateStockCountPayload) => {
      const response = await stockCountApi.create(payload);
      setDetail(response.data);
      emitDataMutation([
        "stock_count_sessions",
        "stock_count_items",
        "audit_logs",
      ]);
      return response.data;
    },
    [],
  );

  const updateItem = useCallback(
    async (
      sessionId: string,
      itemId: string,
      payload: UpdateStockCountItemPayload,
    ) => {
      const response = await stockCountApi.updateItem(
        sessionId,
        itemId,
        payload,
      );
      setDetail(response.data);
      emitDataMutation([
        "stock_count_sessions",
        "stock_count_items",
        "audit_logs",
      ]);
      return response.data;
    },
    [],
  );

  const submitSession = useCallback(async (sessionId: string) => {
    const response = await stockCountApi.submit(sessionId);
    setDetail(response.data);
    emitDataMutation([
      "stock_count_sessions",
      "stock_count_items",
      "nonconformity_reports",
      "quarantine_records",
      "inventory",
      "audit_logs",
    ]);
    return response.data;
  }, []);

  return {
    sessions,
    detail,
    loading,
    detailLoading,
    error,
    loadDetail,
    createSession,
    updateItem,
    submitSession,
    setDetail,
  };
}
