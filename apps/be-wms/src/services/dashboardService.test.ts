import assert from "node:assert/strict";
import test from "node:test";
import {
  ProductType,
  WarehouseType,
  type Inventory,
  type Product,
  type Warehouse,
} from "@bduck/shared-types";
import { buildInventoryDashboardSummary } from "./dashboardAggregation.js";

const stores = [
  { id: "store-a", name: "Store A", type: WarehouseType.STORE },
  { id: "store-b", name: "Store B", type: WarehouseType.STORE },
] as Warehouse[];

const products = [
  {
    id: "product-a",
    name: "Product A",
    code: "A",
    product_type: ProductType.EQUIPMENT,
    unit_price: 100,
  },
  {
    id: "product-b",
    name: "Product B",
    code: "B",
    product_type: ProductType.SOUVENIR_SALE,
    unit_price: 50,
  },
] as Product[];

const inventory = [
  {
    id: "inventory-a",
    warehouse_id: "store-a",
    warehouse_location_id: "location-a",
    product_id: "product-a",
    total_quantity: 12,
    atp_quantity: 10,
    on_hold_quantity: 1,
    in_transit_quantity: 1,
    quarantine_quantity: 0,
  },
  {
    id: "inventory-b",
    warehouse_id: "store-b",
    warehouse_location_id: "location-b",
    product_id: "product-b",
    total_quantity: 3,
    atp_quantity: 0,
    on_hold_quantity: 1,
    in_transit_quantity: 0,
    quarantine_quantity: 2,
  },
] as Inventory[];

test("buildInventoryDashboardSummary aggregates KPIs and ranking data", () => {
  const result = buildInventoryDashboardSummary({
    inventory,
    stores,
    products,
    generatedAt: "2026-07-21T00:00:00.000Z",
  });

  assert.deepEqual(result.kpis, {
    warehouseCount: 2,
    skuCount: 2,
    totalQuantity: 15,
    atpQuantity: 10,
    quarantineQuantity: 2,
    inTransitQuantity: 1,
    onHoldQuantity: 2,
  });
  assert.equal(result.breakdown.length, 2);
  assert.equal(result.topMost[0]?.productId, "product-a");
  assert.equal(result.topLeast[0]?.productId, "product-b");
  assert.equal(result.lowStockProducts[0]?.productId, "product-b");
  assert.equal(
    result.typeDistribution.reduce((total, row) => total + row.quantity, 0),
    15,
  );
});

test("buildInventoryDashboardSummary reports one warehouse for a filtered view", () => {
  const result = buildInventoryDashboardSummary({
    inventory: inventory.slice(0, 1),
    stores,
    products,
    warehouseId: "store-a",
  });

  assert.equal(result.kpis.warehouseCount, 1);
  assert.equal(result.warehouseId, "store-a");
});
