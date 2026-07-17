"use client";

import { useEffect, useMemo, useState } from "react";
import type { RevenueDashboardFilter } from "./useRevenueDashboard";
import { createDetailedApiError, getDetailedErrorMessage } from "@/utils/apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface OnlineSalesSummary {
  orderCount: number;
  itemQuantity: number;
  passesIssued: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  averageOrderValue: number;
}

export interface OnlineDailySale {
  date: string;
  orderCount: number;
  itemQuantity: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
}

export interface OnlineProductSale {
  productId: string;
  productName: string;
  productType: string;
  quantitySold: number;
  grossRevenue: number;
  netRevenue: number;
  orderCount: number;
}

export interface OnlinePaymentProvider {
  provider: string;
  orderCount: number;
  netRevenue: number;
}

export interface OnlineSalesReport {
  success: boolean;
  generatedAt: string;
  timeZone: string;
  range: {
    from: string;
    to: string;
  };
  summary: OnlineSalesSummary;
  dailySales: OnlineDailySale[];
  productSales: OnlineProductSale[];
  paymentProviders: OnlinePaymentProvider[];
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
}

interface UseOnlineSalesReportOptions {
  warehouseId?: string;
  enabled?: boolean;
  keepPreviousData?: boolean;
}

export function useOnlineSalesReport(
  filter: RevenueDashboardFilter,
  options: UseOnlineSalesReportOptions = {},
) {
  const range = useMemo(() => normalizeRange(filter), [filter]);
  const warehouseId = options.warehouseId?.trim() || "";
  const enabled = options.enabled ?? Boolean(warehouseId);
  const keepPreviousData = options.keepPreviousData ?? false;
  const [data, setData] = useState<OnlineSalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !warehouseId) {
      if (!keepPreviousData) setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          warehouseId,
          from: range.startDate,
          to: range.endDate,
        });
        const response = await fetch(`${API_BASE_URL}/api/revenue/online-sales?${qs}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as ApiResponse<OnlineSalesReport> | null;

        if (!response.ok || !json?.success || !json.data) {
          throw createDetailedApiError(response, json, "Khong the tai doanh thu online.");
        }

        setData(json.data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[useOnlineSalesReport] load error:", err);
        if (!keepPreviousData) setData(null);
        setError(getDetailedErrorMessage(err, "Khong the tai doanh thu online."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [enabled, keepPreviousData, range.startDate, range.endDate, warehouseId]);

  return { data, loading, error, range };
}

function normalizeRange(filter: RevenueDashboardFilter): { startDate: string; endDate: string } {
  const today = toDateInput(new Date());
  if (filter.mode === "year") {
    const year = /^\d{4}$/.test(filter.year) ? filter.year : today.slice(0, 4);
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (filter.mode === "month") {
    const month = /^\d{4}-\d{2}$/.test(filter.month) ? filter.month : today.slice(0, 7);
    return { startDate: `${month}-01`, endDate: endOfMonth(`${month}-01`) };
  }
  if (filter.mode === "custom") {
    const startDate = normalizeDate(filter.startDate || today);
    const endDate = normalizeDate(filter.endDate || startDate);
    return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
  }
  const date = normalizeDate(filter.mode === "today" ? today : filter.date || today);
  return { startDate: date, endDate: date };
}

function normalizeDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateInput(new Date());
}

function endOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return toDateInput(new Date(year, month, 0));
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
