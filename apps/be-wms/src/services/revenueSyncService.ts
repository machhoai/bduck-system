/**
 * Revenue Sync Service — JoyWorld → Firestore
 *
 * ═══════════════════════════════════════════════════════════════
 * PURPOSE:
 * - Fetch revenue data from JoyWorld external API
 * - Cache in Firestore `revenue_sync/{period}` collection
 * - Staleness check: only re-fetch if data > STALE_THRESHOLD_MS old
 * - Called on-demand when user opens expense dashboard
 *
 * FLOW:
 * 1. Check `revenue_sync/{period}` in Firestore
 * 2. If sync_time < STALE_THRESHOLD → return cached data
 * 3. Else → call JoyWorld API → upsert Firestore doc
 *
 * RESPONSE STRUCTURE (from JoyWorld):
 * getRevenueData → { data: { dataXs: [
 *   { forDate: "2026-06-01", realMoney: 5000000, sysMoney: ..., ... },
 *   { forDate: "2026-06-02", realMoney: 3000000, ... },
 *   ...
 * ]}}
 *
 * total_revenue = Σ shopRealMoney/totalMoney (doanh thu sau hoàn tiền) across all days in the month
 *
 * COLLECTION SCHEMA (revenue_sync/{period}):
 * {
 *   period: "2026-06",
 *   total_revenue: number,       // Tổng doanh thu sau hoàn tiền cả tháng
 *   shop_real_money: number,     // totalMoney from shop summary (last day)
 *   refund_money: number,        // refundMoney from shop summary
 *   daily_breakdown: Record<string, number>,  // Doanh thu sau hoàn tiền theo ngày
 *   sync_time: Timestamp,
 *   synced_by: string,
 * }
 * ═══════════════════════════════════════════════════════════════
 */

import { AuditAction } from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

import { logAudit } from "./auditService.js";
import {
  getJoyworldToken,
  getRevenueData,
  getShopSummary,
} from "./joyworldService.js";
import { hasEnabledOpenApiConfig } from "./openApiConfigService.js";
import {
  getOpenApiRevenueData,
  getOpenApiShopSummary,
} from "./openApiRevenueService.js";
import { LANDMARK_81_WAREHOUSE_ID } from "./revenueDashboardService.js";
import { getNetShopRevenue, getShopRefundMoney } from "./revenueNetCalculation.js";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COLLECTION = "revenue_sync";
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CALCULATION_VERSION = 2;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RevenueSyncDoc {
  period: string;
  warehouse_id: string;
  calculation_version?: number;
  total_revenue: number;
  shop_real_money: number;
  refund_money: number;
  daily_breakdown: Record<string, number>;
  sync_time: FirebaseFirestore.Timestamp | null;
  synced_by: string;
}

interface SyncResult {
  synced: boolean;
  data: RevenueSyncDoc;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getMonthDateRange(period: string): {
  startDate: string;
  endDate: string;
} {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day of month
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

function isStale(syncTime: FirebaseFirestore.Timestamp | null): boolean {
  if (!syncTime) return true;
  const elapsed = Date.now() - syncTime.toMillis();
  return elapsed > STALE_THRESHOLD_MS;
}

function daysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    days.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchShopSummariesByDate(token: string, days: string[]): Promise<Record<string, unknown>> {
  const responses = await mapLimit(days, 5, (day) => getShopSummary(token, day));
  return Object.fromEntries(days.map((day, index) => [day, responses[index]]));
}

/**
 * Parse JoyWorld revenue response.
 *
 * getRevenueData response: { data: { dataXs: [
 *   { forDate: "YYYY-MM-DD", realMoney: "5000000", sysMoney: "..." },
 *   ...
 * ]}}
 *
 * getShopSummary response: { data: {
 *   totalMoney: "...", shopRealMoney: "...", refundMoney: "...", ...
 * }}
 *
 * total_revenue = sum of shopRealMoney/totalMoney from daily shop summaries.
 * The revenue report's realMoney is retained only as a fallback.
 */
function parseRevenueResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  revenueRes: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summaryRes: any,
  period: string,
  shopSummariesByDate: Record<string, unknown> = {},
): Omit<RevenueSyncDoc, "sync_time" | "synced_by" | "warehouse_id"> {
  // ── Parse daily breakdown from dataXs ──
  const dailyBreakdown: Record<string, number> = {};
  let totalRevenue = 0;

  const dataXs = Array.isArray(revenueRes?.data)
    ? revenueRes.data
    : revenueRes?.data?.dataXs;
  if (Array.isArray(dataXs)) {
    for (const item of dataXs) {
      const forDate = item.forDate;
      // Only keep rows with real date format (skip summary rows like "Tổng cộng")
      if (!forDate || !/^\d{4}-\d{2}-\d{2}$/.test(forDate)) continue;

      const realMoney = parseFloat(item.realMoney) || 0;
      dailyBreakdown[forDate] = realMoney;
      totalRevenue += realMoney;
    }
  }

  for (const [forDate, summary] of Object.entries(shopSummariesByDate)) {
    const netRevenue = getNetShopRevenue(summary);
    if (netRevenue !== null) dailyBreakdown[forDate] = netRevenue;
  }
  if (Object.keys(shopSummariesByDate).length > 0) {
    totalRevenue = Object.values(dailyBreakdown).reduce((sum, value) => sum + value, 0);
  }

  // ── Parse shop summary ──
  const shopRealMoney = getNetShopRevenue(summaryRes) ?? 0;
  const refundMoney = getShopRefundMoney(summaryRes);

  // Use totalRevenue from daily sum; fallback to shopRealMoney for single-day
  if (totalRevenue === 0 && shopRealMoney > 0) {
    totalRevenue = shopRealMoney;
  }

  return {
    period,
    total_revenue: totalRevenue,
    shop_real_money: shopRealMoney,
    refund_money: refundMoney,
    daily_breakdown: dailyBreakdown,
  };
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Sync revenue for a period (month). If data in Firestore is fresh (<5 min), skip.
 * Otherwise, fetch from JoyWorld API and upsert.
 */
export async function syncRevenueForPeriod(
  period: string,
  userId: string,
  warehouseId = LANDMARK_81_WAREHOUSE_ID,
): Promise<SyncResult> {
  const docRef = db.collection(COLLECTION).doc(`${warehouseId}_${period}`);
  const existingSnap = await docRef.get();
  const oldValue = existingSnap.exists
    ? (existingSnap.data() as RevenueSyncDoc)
    : null;

  // Check staleness
  if (existingSnap.exists) {
    const existing = existingSnap.data() as RevenueSyncDoc;
    if (existing.calculation_version === CALCULATION_VERSION && !isStale(existing.sync_time)) {
      return { synced: false, data: existing };
    }
  }

  // Fetch from JoyWorld
  const useOpenApi = await hasEnabledOpenApiConfig(warehouseId);
  let token: string | null = null;
  try {
    token = await getJoyworldToken();
  } catch (error) {
    if (!useOpenApi) throw error;
    console.warn("[revenueSync] Legacy JoyWorld token unavailable; using report revenue fallback.");
  }
  const { startDate, endDate } = getMonthDateRange(period);
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const summaryEndDate = endDate < todayText ? endDate : todayText;
  const summaryDays = summaryEndDate >= startDate ? daysInRange(startDate, summaryEndDate) : [];

  // Call the report and daily net shop summaries in parallel:
  // - getRevenueData: daily breakdown for the entire month (realMoney per day)
  // - getShopSummary: authoritative net revenue after refunds for each day
  const shopSummariesPromise: Promise<Record<string, unknown>> = token
    ? fetchShopSummariesByDate(token, summaryDays)
    : Promise.resolve({});
  const [revenueRes, shopSummariesByDate] = await Promise.all([
    useOpenApi
      ? getOpenApiRevenueData(warehouseId, startDate, endDate)
      : getRevenueData(token as string, startDate, endDate),
    shopSummariesPromise,
  ]);
  const latestSummaryDay = summaryDays.at(-1);
  const latestSummary = latestSummaryDay
    ? shopSummariesByDate[latestSummaryDay]
      ?? (useOpenApi ? await getOpenApiShopSummary(warehouseId, latestSummaryDay) : null)
    : null;

  const parsed = parseRevenueResponse(revenueRes, latestSummary, period, shopSummariesByDate);

  // Upsert to Firestore
  const docData: Record<string, unknown> = {
    ...parsed,
    warehouse_id: warehouseId,
    calculation_version: CALCULATION_VERSION,
    sync_time: FieldValue.serverTimestamp(),
    synced_by: userId,
  };

  await docRef.set(docData, { merge: true });

  // Re-read to get server timestamp
  const refreshed = await docRef.get();
  const finalData = refreshed.data() as RevenueSyncDoc;
  await logAudit({
    entity_type: "revenue_sync",
    entity_id: docRef.id,
    warehouse_id: warehouseId,
    action: oldValue ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: userId,
    old_value: oldValue ? { ...oldValue } : null,
    new_value: { ...finalData },
    notes: "Synchronize store revenue from JoyWorld",
  });

  return { synced: true, data: finalData };
}

/**
 * Get cached revenue data without triggering a sync.
 */
export async function getCachedRevenue(
  period: string,
  warehouseId = LANDMARK_81_WAREHOUSE_ID,
): Promise<RevenueSyncDoc | null> {
  const docRef = db.collection(COLLECTION).doc(`${warehouseId}_${period}`);
  const snap = await docRef.get();
  return snap.exists ? (snap.data() as RevenueSyncDoc) : null;
}
