/**
 * inventoryAggregation — Dashboard KPI computation utilities
 *
 * ► Tất cả tính toán thực hiện client-side từ real-time data
 * ► Tối ưu re-renders bằng cách tách utility ra khỏi component
 */

import type { Inventory } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import type { Product } from "@bduck/shared-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardKPIs {
  warehouseCount: number;
  skuCount: number;
  totalQuantity: number;
  atpQuantity: number;
  quarantineQuantity: number;
  inTransitQuantity: number;
  onHoldQuantity: number;
}

export interface WarehouseBreakdown extends DashboardKPIs {
  warehouseId: string;
  warehouseName: string;
}

export interface ProductStockInfo {
  productId: string;
  productName: string;
  productCode: string;
  totalQuantity: number;
  atpQuantity: number;
  unitPrice: number | null;
  isLowStock: boolean;
}

export interface ProductTypeDistribution {
  type: string;
  quantity: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// KPI Aggregation
// ---------------------------------------------------------------------------

export function computeKPIs(
  inventory: Inventory[],
  warehouses: Warehouse[],
  warehouseFilter?: string,
): DashboardKPIs {
  const filtered = warehouseFilter
    ? inventory.filter((i) => i.warehouse_id === warehouseFilter)
    : inventory;

  const uniqueProducts = new Set(filtered.map((i) => i.product_id));
  const uniqueWarehouses = warehouseFilter
    ? 1
    : new Set(filtered.map((i) => i.warehouse_id)).size;

  return {
    warehouseCount: warehouseFilter ? 1 : warehouses.length,
    skuCount: uniqueProducts.size,
    totalQuantity: filtered.reduce((sum, i) => sum + i.total_quantity, 0),
    atpQuantity: filtered.reduce((sum, i) => sum + i.atp_quantity, 0),
    quarantineQuantity: filtered.reduce(
      (sum, i) => sum + i.quarantine_quantity,
      0,
    ),
    inTransitQuantity: filtered.reduce(
      (sum, i) => sum + i.in_transit_quantity,
      0,
    ),
    onHoldQuantity: filtered.reduce((sum, i) => sum + i.on_hold_quantity, 0),
  };
}

// ---------------------------------------------------------------------------
// Per-Warehouse Breakdown
// ---------------------------------------------------------------------------

export function computeWarehouseBreakdown(
  inventory: Inventory[],
  warehouses: Warehouse[],
): WarehouseBreakdown[] {
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const grouped = new Map<string, Inventory[]>();

  for (const item of inventory) {
    const existing = grouped.get(item.warehouse_id) || [];
    existing.push(item);
    grouped.set(item.warehouse_id, existing);
  }

  return Array.from(grouped.entries()).map(([warehouseId, items]) => {
    const uniqueProducts = new Set(items.map((i) => i.product_id));
    return {
      warehouseId,
      warehouseName: warehouseMap.get(warehouseId) || warehouseId,
      warehouseCount: 1,
      skuCount: uniqueProducts.size,
      totalQuantity: items.reduce((sum, i) => sum + i.total_quantity, 0),
      atpQuantity: items.reduce((sum, i) => sum + i.atp_quantity, 0),
      quarantineQuantity: items.reduce(
        (sum, i) => sum + i.quarantine_quantity,
        0,
      ),
      inTransitQuantity: items.reduce(
        (sum, i) => sum + i.in_transit_quantity,
        0,
      ),
      onHoldQuantity: items.reduce((sum, i) => sum + i.on_hold_quantity, 0),
    };
  });
}

// ---------------------------------------------------------------------------
// Low Stock Alert
// ---------------------------------------------------------------------------

export function computeLowStockProducts(
  inventory: Inventory[],
  products: Product[],
  warehouseFilter?: string,
): ProductStockInfo[] {
  const filtered = warehouseFilter
    ? inventory.filter((i) => i.warehouse_id === warehouseFilter)
    : inventory;

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Aggregate by product
  const productAgg = new Map<
    string,
    { totalQty: number; atpQty: number }
  >();

  for (const item of filtered) {
    const existing = productAgg.get(item.product_id) || {
      totalQty: 0,
      atpQty: 0,
    };
    existing.totalQty += item.total_quantity;
    existing.atpQty += item.atp_quantity;
    productAgg.set(item.product_id, existing);
  }

  const results: ProductStockInfo[] = [];

  for (const [productId, agg] of productAgg) {
    const product = productMap.get(productId);
    if (!product) continue;

    const unitPrice = product.unit_price ?? null;
    const isLow = agg.atpQty <= 0;

    results.push({
      productId,
      productName: product.name,
      productCode: product.code,
      totalQuantity: agg.totalQty,
      atpQuantity: agg.atpQty,
      unitPrice,
      isLowStock: isLow,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Top Products Ranking
// ---------------------------------------------------------------------------

export function computeTopProducts(
  inventory: Inventory[],
  products: Product[],
  warehouseFilter?: string,
  limit = 10,
  order: "most" | "least" = "most",
): ProductStockInfo[] {
  const all = computeLowStockProducts(inventory, products, warehouseFilter);

  const sorted =
    order === "most"
      ? all.sort((a, b) => b.totalQuantity - a.totalQuantity)
      : all.sort((a, b) => a.totalQuantity - b.totalQuantity);

  return sorted.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Product Type Distribution (for Donut chart)
// ---------------------------------------------------------------------------

export function computeProductTypeDistribution(
  inventory: Inventory[],
  products: Product[],
  warehouseFilter?: string,
): ProductTypeDistribution[] {
  const filtered = warehouseFilter
    ? inventory.filter((i) => i.warehouse_id === warehouseFilter)
    : inventory;

  const productMap = new Map(products.map((p) => [p.id, p]));
  const typeAgg = new Map<string, number>();

  for (const item of filtered) {
    const product = productMap.get(item.product_id);
    if (!product) continue;
    const type = product.product_type || "UNKNOWN";
    typeAgg.set(type, (typeAgg.get(type) || 0) + item.total_quantity);
  }

  const total = Array.from(typeAgg.values()).reduce((s, v) => s + v, 0);

  return Array.from(typeAgg.entries()).map(([type, quantity]) => ({
    type,
    quantity,
    percentage: total > 0 ? Math.round((quantity / total) * 100) : 0,
  }));
}

// ---------------------------------------------------------------------------
// Stock Comparison by Warehouse (for Bar chart)
// ---------------------------------------------------------------------------

export interface WarehouseStockComparison {
  warehouseName: string;
  atp: number;
  quarantine: number;
  inTransit: number;
}

export function computeStockComparison(
  inventory: Inventory[],
  warehouses: Warehouse[],
): WarehouseStockComparison[] {
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const grouped = new Map<
    string,
    { atp: number; quarantine: number; inTransit: number }
  >();

  for (const item of inventory) {
    const existing = grouped.get(item.warehouse_id) || {
      atp: 0,
      quarantine: 0,
      inTransit: 0,
    };
    existing.atp += item.atp_quantity;
    existing.quarantine += item.quarantine_quantity;
    existing.inTransit += item.in_transit_quantity;
    grouped.set(item.warehouse_id, existing);
  }

  return Array.from(grouped.entries()).map(([id, data]) => ({
    warehouseName: warehouseMap.get(id) || id,
    ...data,
  }));
}
