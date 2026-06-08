"use client";

/**
 * useInventoryFilter — Filter + sort logic cho WarehouseInventoryView
 *
 * Tách hoàn toàn business logic khỏi UI component.
 * Trả về aggregated rows đã lọc + sắp xếp theo filter state.
 */

import { useMemo, useState } from "react";
import type {
  Inventory,
  Product,
  WarehouseLocation,
} from "@bduck/shared-types";
import { ProductType, ProductOrigin } from "@bduck/shared-types";

// ── Types ──────────────────────────────────────────────────────────────────

export type ViewMode = "card" | "list" | "table";
export type SortField = "name" | "atp" | "total" | "price";
export type SortDir = "asc" | "desc";
export type StockStatus = "all" | "available" | "zero" | "quarantine";

export interface InventoryRow {
  productId: string;
  product: Product;
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
  total: number;
  locations: InventoryLocationBreakdown[];
}

export interface InventoryLocationBreakdown {
  locationId: string;
  name: string;
  code: string;
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
  total: number;
}

export interface InventoryFilterState {
  search: string;
  productType: ProductType | "";
  productOrigin: ProductOrigin | "";
  stockStatus: StockStatus;
  sortBy: SortField;
  sortDir: SortDir;
  viewMode: ViewMode;
}

// ── Default state ──────────────────────────────────────────────────────────

const DEFAULT_FILTER: InventoryFilterState = {
  search: "",
  productType: "",
  productOrigin: "",
  stockStatus: "all",
  sortBy: "total",
  sortDir: "desc",
  viewMode: "card",
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useInventoryFilter(
  inventory: Inventory[],
  products: Product[],
  warehouseId: string,
  locations: WarehouseLocation[] = [],
) {
  const [filters, setFilters] = useState<InventoryFilterState>(DEFAULT_FILTER);

  /** Aggregate inventory by product for this warehouse */
  const aggregated = useMemo<InventoryRow[]>(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const locationMap = new Map(
      locations.map((location) => [location.id, location]),
    );
    const rowMap = new Map<string, InventoryRow>();

    for (const inv of inventory) {
      if (inv.warehouse_id !== warehouseId) continue;
      const product = productMap.get(inv.product_id);
      if (!product) continue;

      const existing = rowMap.get(inv.product_id) ?? {
        productId: inv.product_id,
        product,
        atp: 0,
        onHold: 0,
        inTransit: 0,
        quarantine: 0,
        total: 0,
        locations: [],
      };

      existing.atp += inv.atp_quantity;
      existing.onHold += inv.on_hold_quantity;
      existing.inTransit += inv.in_transit_quantity;
      existing.quarantine += inv.quarantine_quantity;
      existing.total += inv.total_quantity;

      const location = locationMap.get(inv.warehouse_location_id);
      const existingLocation = existing.locations.find(
        (item) => item.locationId === inv.warehouse_location_id,
      );
      const locationBreakdown = existingLocation ?? {
        locationId: inv.warehouse_location_id,
        name: location?.name ?? inv.warehouse_location_id,
        code: location?.code ?? inv.warehouse_location_id,
        atp: 0,
        onHold: 0,
        inTransit: 0,
        quarantine: 0,
        total: 0,
      };

      locationBreakdown.atp += inv.atp_quantity;
      locationBreakdown.onHold += inv.on_hold_quantity;
      locationBreakdown.inTransit += inv.in_transit_quantity;
      locationBreakdown.quarantine += inv.quarantine_quantity;
      locationBreakdown.total += inv.total_quantity;

      if (!existingLocation) {
        existing.locations.push(locationBreakdown);
      }

      rowMap.set(inv.product_id, existing);
    }

    return Array.from(rowMap.values()).map((row) => ({
      ...row,
      locations: row.locations.sort((a, b) => b.total - a.total),
    }));
  }, [inventory, products, warehouseId, locations]);

  /** Apply filter + sort */
  const filteredRows = useMemo<InventoryRow[]>(() => {
    const query = filters.search.toLowerCase().trim();

    let rows = aggregated.filter((row) => {
      // Text search
      if (query) {
        const nameMatch = row.product.name.toLowerCase().includes(query);
        const codeMatch = row.product.code.toLowerCase().includes(query);
        if (!nameMatch && !codeMatch) return false;
      }

      // Product type filter
      if (
        filters.productType &&
        row.product.product_type !== filters.productType
      ) {
        return false;
      }

      // Product origin filter
      if (
        filters.productOrigin &&
        row.product.product_origin !== filters.productOrigin
      ) {
        return false;
      }

      // Stock status filter
      if (filters.stockStatus === "available" && row.atp <= 0) return false;
      if (filters.stockStatus === "zero" && row.atp > 0) return false;
      if (filters.stockStatus === "quarantine" && row.quarantine <= 0)
        return false;

      return true;
    });

    // Sort
    rows = rows.sort((a, b) => {
      let diff = 0;
      switch (filters.sortBy) {
        case "name":
          diff = a.product.name.localeCompare(b.product.name, "vi");
          break;
        case "atp":
          diff = a.atp - b.atp;
          break;
        case "price":
          diff = (a.product.unit_price ?? 0) - (b.product.unit_price ?? 0);
          break;
        case "total":
        default:
          diff = a.total - b.total;
          break;
      }
      return filters.sortDir === "asc" ? diff : -diff;
    });

    return rows;
  }, [aggregated, filters]);

  function updateFilter<K extends keyof InventoryFilterState>(
    key: K,
    value: InventoryFilterState[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTER);
  }

  const hasActiveFilters =
    filters.search !== "" ||
    filters.productType !== "" ||
    filters.productOrigin !== "" ||
    filters.stockStatus !== "all";

  return {
    filters,
    filteredRows,
    totalRows: aggregated.length,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
}
