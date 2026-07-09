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
 * total_revenue = Σ realMoney (thực thu) across all days in the month
 *
 * COLLECTION SCHEMA (revenue_sync/{period}):
 * {
 *   period: "2026-06",
 *   total_revenue: number,       // Σ realMoney (tổng thực thu cả tháng)
 *   shop_real_money: number,     // totalMoney from shop summary (last day)
 *   refund_money: number,        // refundMoney from shop summary
 *   daily_breakdown: Record<string, number>,  // { "2026-06-01": 5000000, ... }
 *   sync_time: Timestamp,
 *   synced_by: string,
 * }
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
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

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COLLECTION = "revenue_sync";
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RevenueSyncDoc {
  period: string;
  warehouse_id: string;
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
 * total_revenue = Σ realMoney from dataXs (thực thu cả tháng)
 */
function parseRevenueResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  revenueRes: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summaryRes: any,
  period: string,
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

  // ── Parse shop summary ──
  const sd = summaryRes?.data;
  const shopRealMoney = sd ? parseFloat(sd.totalMoney) || parseFloat(sd.shopRealMoney) || 0 : 0;
  const refundMoney = sd ? parseFloat(sd.refundMoney) || 0 : 0;

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

  // Check staleness
  if (existingSnap.exists) {
    const existing = existingSnap.data() as RevenueSyncDoc;
    if (!isStale(existing.sync_time)) {
      return { synced: false, data: existing };
    }
  }

  // Fetch from JoyWorld
  const useOpenApi = await hasEnabledOpenApiConfig(warehouseId);
  const token = useOpenApi ? null : await getJoyworldToken();
  const { startDate, endDate } = getMonthDateRange(period);

  console.log(`[revenueSync] Fetching JoyWorld revenue for ${startDate} → ${endDate}`);

  // Call both APIs in parallel:
  // - getRevenueData: daily breakdown for the entire month (realMoney per day)
  // - getShopSummary: summary for last day (totalMoney = thực thu)
  const [revenueRes, summaryRes] = await Promise.all([
    useOpenApi
      ? getOpenApiRevenueData(warehouseId, startDate, endDate)
      : getRevenueData(token as string, startDate, endDate),
    useOpenApi
      ? getOpenApiShopSummary(warehouseId, endDate)
      : getShopSummary(token as string, endDate),
  ]);

  // Debug: log raw responses
  console.log("[revenueSync] revenueRes keys:", Object.keys(revenueRes || {}));
  console.log("[revenueSync] revenueRes.data keys:", Object.keys((revenueRes as any)?.data || {}));
  const dataXs = (revenueRes as any)?.data?.dataXs;
  console.log("[revenueSync] dataXs count:", Array.isArray(dataXs) ? dataXs.length : "not array");
  if (Array.isArray(dataXs) && dataXs.length > 0) {
    console.log("[revenueSync] dataXs[0] sample:", JSON.stringify(dataXs[0]).slice(0, 200));
  }
  console.log("[revenueSync] summaryRes.data:", JSON.stringify((summaryRes as any)?.data || {}).slice(0, 300));

  const parsed = parseRevenueResponse(revenueRes, summaryRes, period);

  console.log("[revenueSync] parsed total_revenue:", parsed.total_revenue);
  console.log("[revenueSync] parsed daily_breakdown entries:", Object.keys(parsed.daily_breakdown).length);

  // Upsert to Firestore
  const docData: Record<string, unknown> = {
    ...parsed,
    warehouse_id: warehouseId,
    sync_time: FieldValue.serverTimestamp(),
    synced_by: userId,
  };

  await docRef.set(docData, { merge: true });

  // Re-read to get server timestamp
  const refreshed = await docRef.get();
  const finalData = refreshed.data() as RevenueSyncDoc;

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
