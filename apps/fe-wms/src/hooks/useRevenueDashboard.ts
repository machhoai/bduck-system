"use client";

import { useCallback, useEffect, useState } from "react";
import { createDetailedApiError, getDetailedErrorMessage } from "@/utils/apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type RevenueDateMode = "today" | "date" | "month" | "year" | "custom";

export interface RevenueDashboardFilter {
  mode: RevenueDateMode;
  date: string;
  month: string;
  year: string;
  startDate: string;
  endDate: string;
}

export interface RevenueMetric {
  value: number;
  previousValue: number;
  changePercent: number;
}

export interface PaymentMethodMetric {
  method: string;
  amount: number;
  orderCount: number;
  percentage: number;
}

export interface RevenueChartPoint {
  key: string;
  label: string;
  revenue: number;
  orderCount: number;
  memberCardAmount: number;
  highlighted: boolean;
}

export interface TopProductItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopProductGroup {
  groupName: string;
  quantity: number;
  revenue: number;
  items: TopProductItem[];
}

export interface RevenueDashboardData {
  warehouseId: string;
  warehouseName: string;
  mode: RevenueDateMode;
  range: {
    startDate: string;
    endDate: string;
    label: string;
    highlightedDates: string[];
  };
  comparisonLabel: string;
  stats: {
    totalRevenue: RevenueMetric;
    totalOrders: RevenueMetric;
    averageOrderValue: RevenueMetric;
    memberCardSales: RevenueMetric;
    paymentMethods: PaymentMethodMetric[];
  };
  charts: {
    granularity: "day" | "month";
    points: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    memberCardSales: RevenueChartPoint[];
  };
  topProductGroups: TopProductGroup[];
  generatedAt: string;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
}

export function getDefaultRevenueFilter(): RevenueDashboardFilter {
  const now = new Date();
  const date = toDateInput(now);
  return {
    mode: "today",
    date,
    month: date.slice(0, 7),
    year: date.slice(0, 4),
    startDate: date,
    endDate: date,
  };
}

export function useRevenueDashboard(filter: RevenueDashboardFilter) {
  const [data, setData] = useState<RevenueDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ mode: filter.mode });
      if (filter.mode === "date") qs.set("date", filter.date);
      if (filter.mode === "month") qs.set("month", filter.month);
      if (filter.mode === "year") qs.set("year", filter.year);
      if (filter.mode === "custom") {
        qs.set("startDate", filter.startDate);
        qs.set("endDate", filter.endDate);
      }

      const response = await fetch(`${API_BASE_URL}/api/revenue/dashboard?${qs}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal,
      });
      const json = (await response.json().catch(() => null)) as ApiResponse<RevenueDashboardData> | null;

      if (!response.ok || !json?.success || !json.data) {
        throw createDetailedApiError(response, json, "Khong the tai dashboard doanh thu.");
      }

      setData(json.data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[useRevenueDashboard] fetch error:", err);
      setError(getDetailedErrorMessage(err, "Khong the tai dashboard doanh thu."));
      setData(null);
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  return { data, loading, error };
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
