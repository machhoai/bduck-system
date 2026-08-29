import type {
  RevenueDashboardData,
  RevenueDataSource,
} from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";

import { resolveCanonicalExternalWarehouseId } from "./externalStoreBindingService.js";
import { loadLocalRevenuePeriod } from "./localRevenueDataService.js";
import { getOpenApiConfig, listOpenApiConfigs } from "./openApiConfigService.js";
import { loadOpenApiRevenuePeriod } from "./openApiRevenueDataService.js";
import { buildRevenueDashboard } from "./revenueDashboardBuilder.js";
import { LANDMARK_81_WAREHOUSE_ID } from "./revenueDashboardService.js";
import {
  normalizeRevenueRange,
  previousRevenueRange,
  type RevenueDashboardQuery,
} from "./revenueDateRange.js";

const CACHE_COLLECTION = "revenue_dashboards";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export interface RevenueSourceDashboardQuery extends RevenueDashboardQuery {
  source: RevenueDataSource;
  warehouseId?: string;
}

export async function resolveRevenueWarehouseId(
  source: RevenueDataSource,
  warehouseId?: string,
): Promise<string> {
  const requested = warehouseId || LANDMARK_81_WAREHOUSE_ID;
  if (source !== "OPEN_API") return requested;

  const canonical = await resolveCanonicalExternalWarehouseId(
    "JOYWORLD_LEGACY",
    requested,
  );
  const config = await getOpenApiConfig(canonical);
  if (config?.enabled && config.has_secret) return canonical;

  throw Object.assign(
    new Error(`OpenAPI config is unavailable for warehouse ${canonical}.`),
    {
      statusCode: 422,
      messages: {
        vi: "Cửa hàng chưa có cấu hình OpenAPI hoạt động.",
        zh: "该门店尚未配置可用的 OpenAPI。",
      },
    },
  );
}

export async function listAvailableOpenApiWarehouseIds(): Promise<string[]> {
  const configs = await listOpenApiConfigs();
  return configs
    .filter((config) => config.enabled && config.has_secret)
    .map((config) => config.warehouse_id);
}

export function getRevenueSourceCacheKey(
  query: RevenueSourceDashboardQuery,
  warehouseId: string,
): string {
  const range = normalizeRevenueRange(query);
  return [
    "v3",
    query.source,
    warehouseId,
    query.mode,
    range.startDate,
    range.endDate,
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/gu, "_");
}

export async function getRevenueSourceDashboardData(
  query: RevenueSourceDashboardQuery,
  userId: string,
): Promise<RevenueDashboardData> {
  const warehouseId = await resolveRevenueWarehouseId(
    query.source,
    query.warehouseId,
  );
  const canonicalQuery = { ...query, warehouseId };
  const cacheKey = getRevenueSourceCacheKey(canonicalQuery, warehouseId);
  const cacheRef = db.collection(CACHE_COLLECTION).doc(cacheKey);

  if (query.source === "OPEN_API") {
    const snapshot = await cacheRef.get();
    const cached = snapshot.data() as
      | {
          dashboard?: RevenueDashboardData;
          sync_time?: FirebaseFirestore.Timestamp | null;
        }
      | undefined;
    if (cached?.dashboard && isFresh(cached.sync_time ?? null)) {
      return cached.dashboard;
    }
  }

  const range = normalizeRevenueRange(canonicalQuery);
  const comparisonRange = previousRevenueRange(canonicalQuery, range);
  const loader =
    query.source === "OPEN_API"
      ? loadOpenApiRevenuePeriod
      : loadLocalRevenuePeriod;
  const warehouse = await warehouseRepository.findById(warehouseId);
  const [current, previous] = await Promise.all([
    loader(warehouseId, range),
    loader(warehouseId, comparisonRange),
  ]);
  const dashboard = buildRevenueDashboard({
    source: query.source,
    taxSource: "LOCAL_POS",
    warehouseId,
    warehouseName: warehouse?.name ?? warehouseId,
    mode: query.mode,
    range,
    comparisonRange,
    current,
    previous,
  });

  if (query.source === "OPEN_API") {
    await cacheRef.set(
      {
        cacheKey,
        warehouse_id: warehouseId,
        source: query.source,
        mode: query.mode,
        range: dashboard.range,
        dashboard,
        sync_time: FieldValue.serverTimestamp(),
        synced_by: userId,
      },
      { merge: true },
    );
  }

  return dashboard;
}

function isFresh(syncTime: FirebaseFirestore.Timestamp | null): boolean {
  return Boolean(
    syncTime && Date.now() - syncTime.toMillis() <= CACHE_MAX_AGE_MS,
  );
}
