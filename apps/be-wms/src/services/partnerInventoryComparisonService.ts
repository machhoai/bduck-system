import { createHash } from "crypto";

import type {
  Inventory,
} from "@bduck/shared-types";

import { findByWarehouse } from "../repositories/inventoryRepository.js";
import {
  createPartnerInventorySnapshot,
  findPartnerWarehouseMapping,
} from "../repositories/partnerInventoryRepository.js";
import { productRepository } from "../repositories/productRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import {
  fetchJoyWorldStock,
  getPartnerInventoryCapability,
} from "./joyWorldInventoryClient.js";
import {
  aggregatePartnerInventoryAtp,
  buildPartnerInventoryComparisonRow,
} from "./partnerInventoryComparisonPolicy.js";
import type { JoyWorldStockRow } from "./partnerInventorySchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

const groupBy = <T>(values: T[], key: (value: T) => string) => {
  const groups = new Map<string, T[]>();
  values.forEach((value) => {
    const groupKey = key(value);
    groups.set(groupKey, [...(groups.get(groupKey) || []), value]);
  });
  return groups;
};

const createRevision = (
  inventory: Inventory[],
  partnerRows: JoyWorldStockRow[],
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        local: inventory
          .map((item) => [item.id, item.product_id, item.atp_quantity])
          .sort(),
        partner: partnerRows
          .map((item) => [item.id, item.giftId, item.amount, item.updateTime])
          .sort(),
      }),
    )
    .digest("hex");

export const createPartnerInventoryComparison = async (
  warehouseId: string,
  actorId: string,
  authorization: AuthorizationService,
) => {
  await loadWarehouseById(warehouseId);
  authorization.assert("partner_inventory.read", warehouseId);
  const capability = getPartnerInventoryCapability();
  const mapping = await findPartnerWarehouseMapping(
    capability.connection_id,
    warehouseId,
  );
  if (!mapping) throw new Error("PARTNER_WAREHOUSE_NOT_MAPPED");

  const [inventory, products, partnerRows] = await Promise.all([
    findByWarehouse(warehouseId),
    productRepository.findAll(false),
    fetchJoyWorldStock(mapping.partner_stock_id),
  ]);
  const atpByProduct = aggregatePartnerInventoryAtp(inventory);
  const productsBySku = groupBy(products, (product) => product.code);
  const partnerBySku = groupBy(partnerRows, (row) => row.giftNo);
  const skus = new Set<string>();
  products.forEach((product) => {
    if (atpByProduct.has(product.id)) skus.add(product.code);
  });
  partnerRows.forEach((row) => skus.add(row.giftNo));
  const rows = Array.from(skus)
    .map((sku) =>
      buildPartnerInventoryComparisonRow({
        sku,
        products: productsBySku.get(sku) || [],
        atpByProduct,
        partnerRows: partnerBySku.get(sku) || [],
      }),
    )
    .sort((left, right) => left.sku.localeCompare(right.sku));

  const now = new Date();
  const ttlMs = Math.max(
    30_000,
    Number(process.env.JOYWORLD_INVENTORY_SNAPSHOT_TTL_MS || 300_000),
  );
  return createPartnerInventorySnapshot({
    actorId,
    snapshot: {
      connection_id: capability.connection_id,
      warehouse_id: warehouseId,
      partner_stock_id: mapping.partner_stock_id,
      partner_stock_name: mapping.partner_stock_name,
      mapping_version: mapping.version,
      source_revision: createRevision(inventory, partnerRows),
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ttlMs).toISOString(),
      rows,
    },
  });
};
