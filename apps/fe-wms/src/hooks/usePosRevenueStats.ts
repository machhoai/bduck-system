"use client";

import type {
  RevenueDashboardFilter,
  RevenueProductGroups,
} from "@bduck/shared-types";
import { useMemo } from "react";

import { usePosRevenuePeriods } from "./usePosRevenuePeriods";

export function usePosRevenueStats(
  warehouseIds: readonly string[],
  filter: RevenueDashboardFilter,
  catalog?: RevenueProductGroups,
  comparisonFilter?: RevenueDashboardFilter | null,
) {
  const periods = usePosRevenuePeriods(
    warehouseIds,
    comparisonFilter ? [filter, comparisonFilter] : [filter],
    catalog,
  );
  const dashboard = periods.data[0];
  const comparisonDashboard = periods.data[1] ?? null;
  const data = useMemo(
    () =>
      dashboard
        ? {
            totalRevenue: dashboard.stats.totalRevenue.value,
            totalOrders: dashboard.stats.totalOrders.value,
            averageOrderValue: dashboard.stats.averageOrderValue.value,
            generatedAt: dashboard.generatedAt,
            dashboard,
          }
        : null,
    [dashboard],
  );
  return {
    data,
    comparisonDashboard,
    warehouseRevenue: periods.warehouseRevenueByPeriod[0] ?? [],
    loading: periods.loading,
    error: periods.error,
  };
}
