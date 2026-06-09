"use client";

/**
 * useInventoryByWarehouse — Derived inventory data filtered by warehouse
 *
 * LUẬT THÉP: Dữ liệu realtime từ useInventory (onSnapshot)
 *
 * Provides:
 * - atpMap: Map<"productId::locationId", atpQty>
 * - getLocationsForProduct(productId): locations with ATP > 0
 * - getAtp(productId, locationId): ATP for a specific combo
 */

import { useMemo } from "react";
import { useInventory } from "./useInventory";

interface LocationAtpInfo {
  locationId: string;
  atpQty: number;
  totalQty: number;
}

interface UseInventoryByWarehouseReturn {
  /** Map key = `${product_id}::${location_id}` → atp_quantity */
  atpMap: Map<string, number>;
  /** Locations that contain a specific product (ATP > 0 only) */
  getLocationsForProduct: (productId: string) => LocationAtpInfo[];
  /** All locations that have any record for a product (including ATP = 0) */
  getAllLocationsForProduct: (productId: string) => LocationAtpInfo[];
  /** ATP for a product at a specific location (0 if not found) */
  getAtp: (productId: string, locationId: string) => number;
  /** Total ATP for a product across the selected warehouse */
  getTotalAtpForProduct: (productId: string) => number;
  loading: boolean;
}

function makeKey(productId: string, locationId: string): string {
  return `${productId}::${locationId}`;
}

export function useInventoryByWarehouse(
  warehouseId?: string,
): UseInventoryByWarehouseReturn {
  const { inventory, loading } = useInventory();

  const warehouseInventory = useMemo(
    () =>
      warehouseId
        ? inventory.filter(
            (inv) =>
              inv.warehouse_id === warehouseId && inv.is_deleted !== true,
          )
        : [],
    [inventory, warehouseId],
  );

  const atpMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of warehouseInventory) {
      map.set(makeKey(inv.product_id, inv.warehouse_location_id), inv.atp_quantity);
    }
    return map;
  }, [warehouseInventory]);

  const getLocationsForProduct = useMemo(
    () => (productId: string): LocationAtpInfo[] => {
      return warehouseInventory
        .filter((inv) => inv.product_id === productId && inv.atp_quantity > 0)
        .map((inv) => ({
          locationId: inv.warehouse_location_id,
          atpQty: inv.atp_quantity,
          totalQty: inv.total_quantity,
        }))
        .sort((a, b) => b.atpQty - a.atpQty);
    },
    [warehouseInventory],
  );

  const getAllLocationsForProduct = useMemo(
    () => (productId: string): LocationAtpInfo[] => {
      return warehouseInventory
        .filter((inv) => inv.product_id === productId)
        .map((inv) => ({
          locationId: inv.warehouse_location_id,
          atpQty: inv.atp_quantity,
          totalQty: inv.total_quantity,
        }));
    },
    [warehouseInventory],
  );

  const getAtp = useMemo(
    () => (productId: string, locationId: string): number => {
      return atpMap.get(makeKey(productId, locationId)) ?? 0;
    },
    [atpMap],
  );

  const getTotalAtpForProduct = useMemo(
    () => (productId: string): number => {
      return warehouseInventory.reduce(
        (sum, inv) =>
          inv.product_id === productId ? sum + Math.max(inv.atp_quantity, 0) : sum,
        0,
      );
    },
    [warehouseInventory],
  );

  return {
    atpMap,
    getLocationsForProduct,
    getAllLocationsForProduct,
    getAtp,
    getTotalAtpForProduct,
    loading,
  };
}
