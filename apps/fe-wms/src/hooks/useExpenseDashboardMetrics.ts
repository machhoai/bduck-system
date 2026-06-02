"use client";

/**
 * useExpenseDashboardMetrics — Real-time KPI data from API
 *
 * ► Fetches dashboard metrics from /api/expenses/dashboard/:warehouseId/:period
 * ► Reacts to warehouseId and period changes
 * ► Returns loading/error states for skeleton handling
 */

import { useState, useEffect, useCallback } from "react";
import { type ExpenseCostCenter } from "@bduck/shared-types";
import { fetchDashboardMetrics } from "./useExpenseApi";

export interface DashboardKPI {
  value: number;
  prevValue: number;
  trend: number; // percentage MoM change
}

export interface TrendPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface CostCenterBreakdown {
  costCenter: ExpenseCostCenter;
  amount: number;
  percentage: number;
  color: string;
}

export interface OverBudgetStore {
  warehouseId: string;
  warehouseName: string;
  budgetUsed: number; // percentage (e.g., 115 means 15% over budget)
  totalBudget: number;
  totalActual: number;
}

export interface DashboardMetrics {
  grossRevenue: DashboardKPI;
  totalExpenses: DashboardKPI;
  netProfit: DashboardKPI;
  profitMargin: DashboardKPI;
  trendData: TrendPoint[];
  costCenterBreakdown: CostCenterBreakdown[];
  overBudgetStores: OverBudgetStore[];
}

const EMPTY_KPI: DashboardKPI = { value: 0, prevValue: 0, trend: 0 };

const EMPTY_METRICS: DashboardMetrics = {
  grossRevenue: EMPTY_KPI,
  totalExpenses: EMPTY_KPI,
  netProfit: EMPTY_KPI,
  profitMargin: EMPTY_KPI,
  trendData: [],
  costCenterBreakdown: [],
  overBudgetStores: [],
};

interface UseExpenseDashboardReturn {
  metrics: DashboardMetrics;
  loading: boolean;
  error: string | null;
}

export function useExpenseDashboardMetrics(
  warehouseId: string,
  period: string,
): UseExpenseDashboardReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!warehouseId || !period) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchDashboardMetrics(
        warehouseId,
        period,
      )) as DashboardMetrics;
      setMetrics(data);
    } catch (err) {
      console.error("[useExpenseDashboardMetrics] fetch error:", err);
      const apiErr = err as { messages?: { vi?: string } };
      setError(apiErr.messages?.vi || "Lỗi tải dữ liệu dashboard");
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, period]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return { metrics, loading, error };
}
