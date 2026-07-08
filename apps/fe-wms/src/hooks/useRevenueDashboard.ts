"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { createDetailedApiError, getDetailedErrorMessage } from "@/utils/apiError";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export type RevenueDateMode = "today" | "date" | "month" | "year" | "custom";
export type RevenueCompareMode = "none" | "previous" | "date" | "month" | "year" | "custom";

export interface RevenueDashboardFilter {
  mode: RevenueDateMode;
  date: string;
  month: string;
  year: string;
  startDate: string;
  endDate: string;
}

export interface RevenueComparisonSelection {
  mode: RevenueCompareMode;
  date: string;
  month: string;
  year: string;
  startDate: string;
  endDate: string;
  dates: string[];
  months: string[];
  years: string[];
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

export interface DeviceConsumptionItem {
  date: string;
  electronicCoinConsum: number;
  physicalCoinConsum: number;
  totalConsum: number;
  coinGiveQuantity: number;
  coinConsumRate: string;
}

export interface RevenueOrderItem {
  orderId: string;
  orderNumber: string;
  status: number;
  statusLabel: string;
  createTime: string;
  employeeName: string;
  payMethod: string;
  terminalName: string;
  totalQty: number;
  itemCount: number;
  sysMoney: number;
  discountMoney: number;
  realMoney: number;
  cancelMoney: number;
}

export interface SoldOrderGoodsItem {
  id: string;
  orderId: string;
  orderNumber: string;
  status: number;
  statusLabel: string;
  createTime: string;
  employeeName: string;
  payMethod: string;
  goodsName: string;
  goodsTypeName: string;
  categoryName: string;
  price: number;
  qty: number;
  sysMoney: number;
  discountMoney: number;
  realMoney: number;
  cancelQty: number;
  cancelMoney: number;
}

export interface RevenueDashboardData {
  warehouseId: string;
  warehouseName: string;
  mode: RevenueDateMode;
  cacheKey: string;
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
    deviceConsumption: RevenueMetric;
    memberCount: RevenueMetric;
    memberStoredBalance: RevenueMetric;
    memberGiftBalance: RevenueMetric;
    paymentMethods: PaymentMethodMetric[];
  };
  charts: {
    granularity: "day" | "month";
    points: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    memberCardSales: RevenueChartPoint[];
  };
  topProductGroups: TopProductGroup[];
  deviceConsumptions: DeviceConsumptionItem[];
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
  generatedAt: string;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
}

interface FirestoreDashboardDoc {
  dashboard?: RevenueDashboardData;
  sync_time?: Timestamp | null;
}

interface UseRevenueDashboardOptions {
  enabled?: boolean;
}

export function getDefaultRevenueFilter(): RevenueDashboardFilter {
  const now = new Date();
  const date = toDateInput(now);
  return {
    mode: "date",
    date,
    month: date.slice(0, 7),
    year: date.slice(0, 4),
    startDate: date,
    endDate: date,
  };
}

export function getDefaultRevenueComparison(filter: RevenueDashboardFilter): RevenueComparisonSelection {
  const previous = getPreviousComparisonRange(filter);
  return {
    mode: "none",
    date: previous.endDate,
    month: previous.startDate.slice(0, 7),
    year: previous.startDate.slice(0, 4),
    startDate: previous.startDate,
    endDate: previous.endDate,
    dates: [],
    months: [],
    years: [],
  };
}

export function buildRevenueComparisonFilters(
  filter: RevenueDashboardFilter,
  comparison: RevenueComparisonSelection,
): RevenueDashboardFilter[] {
  const comparisonMode = getCompatibleComparisonMode(filter.mode, comparison.mode);
  if (comparisonMode === "none") return [];

  if (comparisonMode === "previous") {
    const range = getPreviousComparisonRange(filter);
    return [comparisonFilterFromRange(filter, range)];
  }

  if (comparisonMode === "date") {
    const currentDate = normalizeRange(filter).endDate;
    const dates = uniqueValues(comparison.dates.length > 0 ? comparison.dates : [comparison.date])
      .map(normalizeDate)
      .filter((date) => date !== currentDate);
    return dates.map((date) => ({ ...filter, mode: "date", date, month: date.slice(0, 7), year: date.slice(0, 4), startDate: date, endDate: date }));
  }

  if (comparisonMode === "month") {
    const today = toDateInput(new Date());
    const currentMonth = normalizeRange(filter).startDate.slice(0, 7);
    const months = uniqueValues(comparison.months.length > 0 ? comparison.months : [comparison.month])
      .map((month) => (/^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7)))
      .filter((month) => month !== currentMonth);
    return months.map((month) => ({ ...filter, mode: "month", date: `${month}-01`, month, year: month.slice(0, 4), startDate: `${month}-01`, endDate: endOfMonth(`${month}-01`) }));
  }

  if (comparisonMode === "year") {
    const today = toDateInput(new Date());
    const currentYear = normalizeRange(filter).startDate.slice(0, 4);
    const years = uniqueValues(comparison.years.length > 0 ? comparison.years : [comparison.year])
      .map((year) => (/^\d{4}$/.test(year) ? year : today.slice(0, 4)))
      .filter((year) => year !== currentYear);
    return years.map((year) => ({ ...filter, mode: "year", date: `${year}-01-01`, month: `${year}-01`, year, startDate: `${year}-01-01`, endDate: `${year}-12-31` }));
  }

  const startDate = normalizeDate(comparison.startDate);
  const endDate = normalizeDate(comparison.endDate || startDate);
  const ordered = startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
  return [{
    ...filter,
    mode: "custom",
    date: ordered.endDate,
    month: ordered.startDate.slice(0, 7),
    year: ordered.startDate.slice(0, 4),
    startDate: ordered.startDate,
    endDate: ordered.endDate,
  }];
}

export function buildRevenueComparisonFilter(
  filter: RevenueDashboardFilter,
  comparison: RevenueComparisonSelection,
): RevenueDashboardFilter | null {
  return buildRevenueComparisonFilters(filter, comparison)[0] ?? null;
}

export function getRevenueComparisonLabel(filter: RevenueDashboardFilter | null): string {
  if (!filter) return "";
  const range = normalizeRange(filter);
  if (range.startDate === range.endDate) return `Ngày ${formatDisplayDate(range.startDate)}`;
  if (range.startDate.slice(0, 7) === range.endDate.slice(0, 7) && range.startDate.endsWith("-01") && range.endDate === endOfMonth(range.startDate)) {
    return `Tháng ${formatDisplayMonth(range.startDate.slice(0, 7))}`;
  }
  if (range.startDate.endsWith("-01-01") && range.endDate.endsWith("-12-31") && range.startDate.slice(0, 4) === range.endDate.slice(0, 4)) {
    return `Năm ${range.startDate.slice(0, 4)}`;
  }
  return `Từ ${formatDisplayDate(range.startDate)} đến ${formatDisplayDate(range.endDate)}`;
}

export function getRevenueComparisonLabels(filters: RevenueDashboardFilter[]): string[] {
  return filters.map(getRevenueComparisonLabel);
}

export function useRevenueDashboard(filter: RevenueDashboardFilter, options: UseRevenueDashboardOptions = {}) {
  const enabled = options.enabled ?? true;
  const [dashboard, setDashboard] = useState<RevenueDashboardData | null>(null);
  const [orders, setOrders] = useState<RevenueOrderItem[]>([]);
  const [soldItems, setSoldItems] = useState<SoldOrderGoodsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestDataRef = useRef<RevenueDashboardData | null>(null);
  const syncingRef = useRef(false);
  const cacheKey = useMemo(() => getRevenueDashboardCacheKey(filter), [filter]);
  const data = useMemo<RevenueDashboardData | null>(() => {
    if (!dashboard) return null;
    return { ...dashboard, orders, soldItems };
  }, [dashboard, orders, soldItems]);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    try {
      const qs = buildDashboardQuery(filter);
      await fetchRevenueDashboard(qs, signal);
    } catch (err) {
      if (signal?.aborted || (err as Error).name === "AbortError") return;
      setError(getRevenueDashboardErrorMessage(err));
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      if (!latestDataRef.current && !signal?.aborted) setLoading(false);
    }
  }, [enabled, filter]);

  useEffect(() => {
    if (!enabled) {
      latestDataRef.current = null;
      setDashboard(null);
      setOrders([]);
      setSoldItems([]);
      setLoading(false);
      setSyncing(false);
      setError(null);
      return;
    }

    latestDataRef.current = null;
    setDashboard(null);
    setOrders([]);
    setSoldItems([]);
    setLoading(true);
    setError(null);

    let unsubscribeSnapshot: (() => void) | undefined;
    let unsubscribeOrders: (() => void) | undefined;
    let unsubscribeSoldItems: (() => void) | undefined;
    let isDisposed = false;
    const controller = new AbortController();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }
      if (unsubscribeOrders) {
        unsubscribeOrders();
        unsubscribeOrders = undefined;
      }
      if (unsubscribeSoldItems) {
        unsubscribeSoldItems();
        unsubscribeSoldItems = undefined;
      }

      if (!user) {
        latestDataRef.current = null;
        setDashboard(null);
        setOrders([]);
        setSoldItems([]);
        setLoading(false);
        return;
      }

      const docRef = doc(db, "revenue_dashboards", cacheKey);
      unsubscribeSnapshot = onSnapshot(
        docRef,
        (snapshot) => {
          if (isDisposed) return;

          if (!snapshot.exists()) {
            void loadData(controller.signal);
            return;
          }

          const snapshotData = snapshot.data() as FirestoreDashboardDoc;
          const dashboard = snapshotData.dashboard ?? null;
          const syncTime = snapshotData.sync_time?.toDate?.() ?? null;

          latestDataRef.current = dashboard;
          setDashboard(dashboard);
          setLoading(false);

          if (!unsubscribeOrders) {
            unsubscribeOrders = onSnapshot(collection(db, "revenue_dashboards", cacheKey, "orders"), (ordersSnapshot) => {
              if (isDisposed) return;
              setOrders(ordersSnapshot.docs
                .map((orderDoc) => orderDoc.data() as RevenueOrderItem & { is_deleted?: boolean })
                .filter((row) => !row.is_deleted)
                .sort((a, b) => b.createTime.localeCompare(a.createTime)));
            });
          }

          if (!unsubscribeSoldItems) {
            unsubscribeSoldItems = onSnapshot(collection(db, "revenue_dashboards", cacheKey, "sold_items"), (itemsSnapshot) => {
              if (isDisposed) return;
              setSoldItems(itemsSnapshot.docs
                .map((itemDoc) => itemDoc.data() as SoldOrderGoodsItem & { is_deleted?: boolean })
                .filter((row) => !row.is_deleted)
                .sort((a, b) => b.createTime.localeCompare(a.createTime)));
            });
          }

          if (isStale(syncTime)) {
            void loadData(controller.signal);
          }
        },
        (snapshotError) => {
          console.warn("[useRevenueDashboard] onSnapshot error:", snapshotError);
          setError(snapshotError.message);
          setLoading(false);
        },
      );
    });

    return () => {
      isDisposed = true;
      controller.abort();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeSoldItems) unsubscribeSoldItems();
    };
  }, [cacheKey, enabled, loadData]);

  return { data, loading, syncing, error, cacheKey };
}

export function useRevenueDashboardComparisons(filters: RevenueDashboardFilter[]) {
  const [data, setData] = useState<RevenueDashboardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters.map(buildDashboardQuery)), [filters]);

  useEffect(() => {
    if (filters.length === 0) {
      setData([]);
      setLoading(false);
      setSyncing(false);
      setError(null);
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();
    setLoading(true);
    setSyncing(true);
    setError(null);

    Promise.all(filters.map((filter) => fetchRevenueDashboard(buildDashboardQuery(filter), controller.signal)))
      .then((dashboards) => {
        if (isDisposed) return;
        setData(dashboards);
      })
      .catch((err) => {
        if (controller.signal.aborted || (err as Error).name === "AbortError") return;
        setError(getRevenueDashboardErrorMessage(err));
      })
      .finally(() => {
        if (isDisposed) return;
        setLoading(false);
        setSyncing(false);
      });

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [filtersKey]);

  return { data, loading, syncing, error };
}

async function fetchRevenueDashboard(qs: string, signal?: AbortSignal): Promise<RevenueDashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/revenue/dashboard?${qs}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const json = (await response.json().catch(() => null)) as ApiResponse<RevenueDashboardData> | null;

  if (!response.ok || !json?.success || !json.data) {
    throw createDetailedApiError(response, json, "Khong the tai dashboard doanh thu.");
  }

  return json.data;
}

function getRevenueDashboardErrorMessage(error: unknown): string {
  if (isFetchNetworkError(error)) {
    return "Không thể kết nối API doanh thu. Vui lòng kiểm tra backend hoặc NEXT_PUBLIC_API_URL.";
  }
  return getDetailedErrorMessage(error, "Khong the tai dashboard doanh thu.");
}

function isFetchNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|networkerror|load failed/i.test(error.message);
}

function formatDisplayDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function formatDisplayMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  return `${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function comparisonFilterFromRange(
  filter: RevenueDashboardFilter,
  range: { startDate: string; endDate: string },
): RevenueDashboardFilter {
  if (filter.mode === "today" || filter.mode === "date") {
    return {
      ...filter,
      mode: "date",
      date: range.endDate,
      month: range.endDate.slice(0, 7),
      year: range.endDate.slice(0, 4),
      startDate: range.endDate,
      endDate: range.endDate,
    };
  }
  if (filter.mode === "month") {
    const month = range.startDate.slice(0, 7);
    return {
      ...filter,
      mode: "month",
      date: `${month}-01`,
      month,
      year: month.slice(0, 4),
      startDate: `${month}-01`,
      endDate: endOfMonth(`${month}-01`),
    };
  }
  if (filter.mode === "year") {
    const year = range.startDate.slice(0, 4);
    return {
      ...filter,
      mode: "year",
      date: `${year}-01-01`,
      month: `${year}-01`,
      year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }
  return {
    ...filter,
    mode: "custom",
    date: range.endDate,
    month: range.startDate.slice(0, 7),
    year: range.startDate.slice(0, 4),
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getCompatibleComparisonMode(currentMode: RevenueDateMode, comparisonMode: RevenueCompareMode): RevenueCompareMode {
  if (comparisonMode === "none" || comparisonMode === "previous") return comparisonMode;
  if ((currentMode === "today" || currentMode === "date") && comparisonMode === "date") return comparisonMode;
  if (currentMode === "month" && comparisonMode === "month") return comparisonMode;
  if (currentMode === "year" && comparisonMode === "year") return comparisonMode;
  if (currentMode === "custom" && comparisonMode === "custom") return comparisonMode;
  return "previous";
}

function buildDashboardQuery(filter: RevenueDashboardFilter): string {
  const qs = new URLSearchParams({ mode: filter.mode });
  if (filter.mode === "date") qs.set("date", filter.date);
  if (filter.mode === "month") qs.set("month", filter.month);
  if (filter.mode === "year") qs.set("year", filter.year);
  if (filter.mode === "custom") {
    qs.set("startDate", filter.startDate);
    qs.set("endDate", filter.endDate);
  }
  return qs.toString();
}

function getRevenueDashboardCacheKey(filter: RevenueDashboardFilter): string {
  const range = normalizeRange(filter);
  return `${filter.mode}_${range.startDate}_${range.endDate}`.replace(/[^a-zA-Z0-9_-]/g, "_");
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

function getPreviousComparisonRange(filter: RevenueDashboardFilter): { startDate: string; endDate: string } {
  const range = normalizeRange(filter);
  if (filter.mode === "today" || filter.mode === "date") {
    return { startDate: addDays(range.startDate, -1), endDate: addDays(range.endDate, -1) };
  }
  if (filter.mode === "month") {
    const previousMonth = addMonths(range.startDate, -1).slice(0, 7);
    return { startDate: `${previousMonth}-01`, endDate: endOfMonth(`${previousMonth}-01`) };
  }
  if (filter.mode === "year") {
    const year = Number(range.startDate.slice(0, 4)) - 1;
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }

  const days = diffDays(range.startDate, range.endDate) + 1;
  return {
    startDate: addDays(range.startDate, -days),
    endDate: addDays(range.startDate, -1),
  };
}

function isStale(syncTime: Date | null): boolean {
  if (!syncTime) return true;
  return Date.now() - syncTime.getTime() > STALE_THRESHOLD_MS;
}

function normalizeDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateInput(new Date());
}

function endOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return toDateInput(new Date(year, month, 0));
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

function addMonths(value: string, months: number): string {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + months);
  return toDateInput(date);
}

function diffDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  return Math.round((end - start) / 86_400_000);
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
