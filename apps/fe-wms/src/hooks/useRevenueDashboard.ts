"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { createDetailedApiError, getDetailedErrorMessage } from "@/utils/apiError";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

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
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    try {
      const qs = buildDashboardQuery(filter);
      const response = await fetch(`${API_BASE_URL}/api/revenue/dashboard?${qs}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal,
      });
      const json = (await response.json().catch(() => null)) as ApiResponse<RevenueDashboardData> | null;

      if (!response.ok || !json?.success || !json.data) {
        throw createDetailedApiError(response, json, "Khong the tai dashboard doanh thu.");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[useRevenueDashboard] sync error:", err);
      setError(getDetailedErrorMessage(err, "Khong the tai dashboard doanh thu."));
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      if (!latestDataRef.current && !signal?.aborted) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
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
  }, [cacheKey, loadData]);

  return { data, loading, syncing, error, cacheKey };
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

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
