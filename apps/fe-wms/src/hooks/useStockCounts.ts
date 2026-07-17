"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
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
import {
  getFacilityPermissionScope,
  scopeContainsFacility,
} from "@/utils/facilityPermissionScope";

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

export function useStockCounts(options: { warehouseId?: string } = {}) {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () =>
      getFacilityPermissionScope(permissions, STOCK_COUNT_ACCESS_PERMISSIONS),
    [permissions],
  );
  const queryScope = useMemo(() => {
    if (!options.warehouseId) return facilityScope;
    return {
      isSystemAdmin: false,
      facilityIds: scopeContainsFacility(facilityScope, options.warehouseId)
        ? [options.warehouseId]
        : [],
    };
  }, [facilityScope, options.warehouseId]);
  const [sessions, setSessions] = useState<StockCountSessionRow[]>([]);
  const [detail, setDetail] = useState<StockCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const applyRows = useCallback(
    (rows: StockCountSessionRow[]) => {
      setSessions(
        rows
          .filter(
            (row) =>
              !options.warehouseId || row.warehouse_id === options.warehouseId,
          )
          .sort((a, b) => toTime(b.created_at) - toTime(a.created_at)),
      );
    },
    [options.warehouseId],
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

    const unsubscribe = subscribeToMergedQueries<StockCountSessionRow>({
      queries: buildFacilityScopedQueries({
        db,
        collectionName: "stock_count_sessions",
        facilityField: "warehouse_id",
        scope: queryScope,
        constraints: [
          where("source", "==", "INTERNAL_UI"),
          where("is_deleted", "==", false),
        ],
      }),
      mapDocument: (document) => ({
        ...document.data(),
        id: document.id,
      }) as StockCountSessionRow,
      onData: (rows) => {
        applyRows(rows);
        setLoading(false);
        setError(null);
      },
      onError: (snapshotError) => {
        console.warn("[useStockCounts] snapshot failed", snapshotError);
        void loadFallback();
      },
    });

    return () => {
      unsubscribeMutation();
      unsubscribe();
    };
  }, [applyRows, loadFallback, queryScope]);

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
