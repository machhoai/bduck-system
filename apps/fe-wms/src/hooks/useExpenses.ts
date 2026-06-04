"use client";

/**
 * useExpenses — Data fetching hook for Expense Management
 *
 * Handles:
 * - Loading expense data from REST API
 * - Optimistic updates (no reload after save)
 * - Creating/updating custom expense items (user-defined)
 * - Soft-deleting custom expense items
 * - Closing/reopening the accounting period
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ExpenseDocument, ExpenseItem, ExpenseCustomItem } from "@bduck/shared-types";
import {
  fetchExpenseData,
  updateExpenseItemApi,
  closePeriodApi,
  reopenPeriodApi,
  saveCustomExpenseItem,
  deleteCustomExpenseItem,
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
  saveCustomItem: (
    itemId: string,
    itemData: {
      label: string;
      cost_center: string;
      actual_amount: number;
      budget_amount: number | null;
      note?: string | null;
    },
  ) => Promise<void>;
  deleteCustomItem: (itemId: string) => Promise<void>;
  closePeriod: () => Promise<void>;
  reopenPeriod: () => Promise<void>;
}

export function useExpenses(
  warehouseId: string,
  period: string,
): UseExpensesReturn {
  const [data, setData] = useState<ExpenseDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

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

  /**
   * Optimistic updateItem — cập nhật local state trước, gọi API song song.
   * Nếu API fail → rollback + refresh.
   */
  const updateItem = useCallback(
    async (category: string, itemData: Record<string, unknown>) => {
      const prev = dataRef.current;
      if (!prev) return;

      // Optimistic update
      const currentItem = prev.items[category as keyof typeof prev.items] as ExpenseItem | undefined;
      const updatedItem = { ...(currentItem ?? { actual_amount: 0, budget_amount: null, suggested_amount: null, attachments: [], note: null }), ...itemData } as ExpenseItem;
      setData({
        ...prev,
        items: { ...prev.items, [category]: updatedItem },
      });

      // Fire API (no await refresh)
      try {
        await updateExpenseItemApi(warehouseId, period, category, itemData);
      } catch (err) {
        console.error("[useExpenses] save error, rolling back:", err);
        setData(prev); // rollback
        throw err; // re-throw for toast
      }
    },
    [warehouseId, period],
  );

  /**
   * Optimistic saveCustomItem — thêm/cập nhật custom item trực tiếp trong state.
   */
  const saveCustomItemFn = useCallback(
    async (
      itemId: string,
      itemData: {
        label: string;
        cost_center: string;
        actual_amount: number;
        budget_amount: number | null;
        note?: string | null;
      },
    ) => {
      const prev = dataRef.current;
      if (!prev) return;

      // Build optimistic custom item
      const existingItem = prev.custom_items?.[itemId];
      const optimisticItem: ExpenseCustomItem = {
        id: itemId,
        label: itemData.label,
        cost_center: itemData.cost_center as ExpenseCustomItem["cost_center"],
        actual_amount: itemData.actual_amount,
        budget_amount: itemData.budget_amount,
        suggested_amount: existingItem?.suggested_amount ?? null,
        attachments: existingItem?.attachments ?? [],
        note: itemData.note ?? existingItem?.note ?? null,
        is_deleted: false,
      };

      setData({
        ...prev,
        custom_items: { ...prev.custom_items, [itemId]: optimisticItem },
      });

      try {
        await saveCustomExpenseItem(warehouseId, period, itemId, itemData);
      } catch (err) {
        console.error("[useExpenses] save custom item error, rolling back:", err);
        setData(prev);
        throw err;
      }
    },
    [warehouseId, period],
  );

  /**
   * Optimistic deleteCustomItem — set is_deleted = true trước.
   */
  const deleteCustomItemFn = useCallback(
    async (itemId: string) => {
      const prev = dataRef.current;
      if (!prev || !prev.custom_items?.[itemId]) return;

      // Optimistic: mark deleted
      const updatedCustomItems = { ...prev.custom_items };
      updatedCustomItems[itemId] = { ...updatedCustomItems[itemId], is_deleted: true };
      setData({ ...prev, custom_items: updatedCustomItems });

      try {
        await deleteCustomExpenseItem(warehouseId, period, itemId);
      } catch (err) {
        console.error("[useExpenses] delete custom item error, rolling back:", err);
        setData(prev);
        throw err;
      }
    },
    [warehouseId, period],
  );

  const closePeriodFn = useCallback(async () => {
    await closePeriodApi(warehouseId, period);
    await refresh();
  }, [warehouseId, period, refresh]);

  const reopenPeriodFn = useCallback(async () => {
    await reopenPeriodApi(warehouseId, period);
    await refresh();
  }, [warehouseId, period, refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    updateItem,
    saveCustomItem: saveCustomItemFn,
    deleteCustomItem: deleteCustomItemFn,
    closePeriod: closePeriodFn,
    reopenPeriod: reopenPeriodFn,
  };
}
