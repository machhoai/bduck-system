"use client";

/**
 * useExpenseDashboardMetrics — Real-time KPI data from API
 *
 * ► Fetches dashboard metrics from /api/expenses/dashboard/:warehouseId/:period
 * ► Includes per-cost-center stats, trend data, and top expenses
 * ► Returns loading/error states for skeleton handling
 */

import { useState, useEffect, useCallback } from "react";
import { type ExpenseCostCenter } from "@bduck/shared-types";
import { fetchDashboardMetrics } from "./useExpenseApi";
import { getDetailedErrorMessage } from "@/utils/apiError";

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

export interface CostCenterStat {
  costCenter: ExpenseCostCenter;
  actualTotal: number;
  budgetTotal: number;
  usagePercent: number;
  trend: number; // MoM change %
}

export interface TopExpenseItem {
  category: string;
  label: string;
  amount: number;
  prevAmount: number;
  changePercent: number;
  costCenter: ExpenseCostCenter;
}

export interface RevenueExpenseMonthly {
  month: string;
  revenue: number;
  expenses: number;
  net: number; // revenue - expenses (positive = profit, negative = loss)
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
  costCenterStats: CostCenterStat[];
  topExpenses: TopExpenseItem[];
  revenueExpenseMonthly: RevenueExpenseMonthly[];
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
  costCenterStats: [],
  topExpenses: [],
  revenueExpenseMonthly: [],
  overBudgetStores: [],
};

interface UseExpenseDashboardReturn {
  metrics: DashboardMetrics;
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
}

interface UseExpenseDashboardOptions {
  keepPreviousData?: boolean;
}

export function useExpenseDashboardMetrics(
  warehouseId: string,
  period: string,
  options: UseExpenseDashboardOptions = {},
): UseExpenseDashboardReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepPreviousData = options.keepPreviousData ?? false;

  const loadMetrics = useCallback(async () => {
    if (!warehouseId || !period) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchDashboardMetrics(
        warehouseId,
        period,
      )) as Partial<DashboardMetrics>;
      setMetrics({ ...EMPTY_METRICS, ...data });
      setHasLoaded(true);
    } catch (err) {
      console.error("[useExpenseDashboardMetrics] fetch error:", err);
      setError(getDetailedErrorMessage(err, "Lỗi tải dữ liệu dashboard"));
      if (!keepPreviousData) setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, [keepPreviousData, warehouseId, period]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return { metrics, loading, error, hasLoaded };
}
