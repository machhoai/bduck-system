import {
  WarehouseType,
  type InventoryDashboardSummary,
} from "@bduck/shared-types";
import * as inventoryRepository from "../repositories/inventoryRepository.js";
import { productRepository } from "../repositories/productRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { buildInventoryDashboardSummary } from "./dashboardAggregation.js";

export { buildInventoryDashboardSummary } from "./dashboardAggregation.js";

const SUMMARY_CACHE_TTL_MS = 15_000;
const summaryCache = new Map<
  string,
  { expiresAt: number; value: InventoryDashboardSummary }
>();

export const fetchInventoryDashboardSummary = async (
  authorization: AuthorizationService,
  warehouseId?: string,
): Promise<InventoryDashboardSummary> => {
  const selectedWarehouseId = warehouseId || null;
  if (selectedWarehouseId) {
    authorization.assert("inventory.read", selectedWarehouseId);
  }
  const cacheKey = [
    authorization.context.actorId,
    authorization.context.computedAt,
    selectedWarehouseId ?? "all",
  ].join(":");
  const cached = summaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inventoryFacilityIds = authorization.facilityIdsFor("inventory.read");
  const accessibleWarehouses = await warehouseRepository.findWarehousesScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: inventoryFacilityIds,
  });
  const stores = accessibleWarehouses.filter(
    (warehouse) => warehouse.type === WarehouseType.STORE,
  );
  const storeIds = selectedWarehouseId
    ? stores.some((store) => store.id === selectedWarehouseId)
      ? [selectedWarehouseId]
      : []
    : stores.map((store) => store.id);
  const inventory = selectedWarehouseId
    ? storeIds.length > 0
      ? await inventoryRepository.findByWarehouse(selectedWarehouseId)
      : []
    : await inventoryRepository.findAllScoped(
        {},
        {
          isSystemAdmin: authorization.context.isSystemAdmin,
          facilityIds: storeIds,
        },
      );
  const products = await productRepository.findByIds(
    inventory.map((record) => record.product_id),
  );
  const summary = buildInventoryDashboardSummary({
    inventory,
    stores,
    products,
    warehouseId: selectedWarehouseId,
  });
  if (summaryCache.size > 200) summaryCache.clear();
  summaryCache.set(cacheKey, {
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
    value: summary,
  });
  return summary;
};
