"use client";

/**
 * useExpenses — Data fetching hook for Expense Management
 *
 * Handles:
 * - Loading expense data from REST API
 * - Updating single expense items
 * - Closing the accounting period
 */

import { useState, useEffect, useCallback } from "react";
import type { ExpenseDocument } from "@bduck/shared-types";
import {
  fetchExpenseData,
  updateExpenseItemApi,
  closePeriodApi,
} from "./useExpenseApi";

interface UseExpensesReturn {
  data: ExpenseDocument | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateItem: (
    category: string,
    itemData: Record<string, unknown>,
  ) => Promise<void>;
  closePeriod: () => Promise<void>;
}

export function useExpenses(
  warehouseId: string,
  period: string,
): UseExpensesReturn {
  const [data, setData] = useState<ExpenseDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!warehouseId || !period) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExpenseData(warehouseId, period);
      setData(result as ExpenseDocument);
    } catch (err) {
      console.error("[useExpenses] fetch error:", err);
      const apiErr = err as { messages?: { vi?: string } };
      setError(apiErr.messages?.vi || "Lỗi tải dữ liệu chi phí");
    } finally {
      setLoading(false);
    }
  }, [warehouseId, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateItem = useCallback(
    async (category: string, itemData: Record<string, unknown>) => {
      await updateExpenseItemApi(warehouseId, period, category, itemData);
      await refresh();
    },
    [warehouseId, period, refresh],
  );

  const closePeriodFn = useCallback(async () => {
    await closePeriodApi(warehouseId, period);
    await refresh();
  }, [warehouseId, period, refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    updateItem,
    closePeriod: closePeriodFn,
  };
}
