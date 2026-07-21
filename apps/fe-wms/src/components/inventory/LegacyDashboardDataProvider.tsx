"use client";

import { useEffect, useMemo } from "react";
import type { InventoryDashboardSummary } from "@bduck/shared-types";
import { useInventory } from "@/hooks/useInventory";
import { useProducts } from "@/hooks/useProducts";
import { useStores } from "@/hooks/useWarehouses";
import {
  computeKPIs,
  computeLowStockProducts,
  computeProductTypeDistribution,
  computeStockComparison,
  computeTopProducts,
  computeWarehouseBreakdown,
} from "@/utils/inventoryAggregation";

export interface LegacyDashboardState {
  data: InventoryDashboardSummary | null;
  loading: boolean;
  error: Error | null;
}

export default function LegacyDashboardDataProvider({
  warehouseId,
  onChange,
}: {
  warehouseId?: string;
  onChange: (state: LegacyDashboardState) => void;
}) {
  const {
    inventory,
    loading: inventoryLoading,
    error: inventoryError,
  } = useInventory();
  const {
    products,
    loading: productsLoading,
    error: productsError,
  } = useProducts();
  const { stores, loading: storesLoading, error: storesError } = useStores();
  const loading = inventoryLoading || productsLoading || storesLoading;
  const errorMessage = inventoryError || storesError || productsError?.message;
  const error = useMemo(
    () => (errorMessage ? new Error(errorMessage) : null),
    [errorMessage],
  );
  const data = useMemo<InventoryDashboardSummary | null>(() => {
    if (loading) return null;
    return {
      warehouseId: warehouseId ?? null,
      generatedAt: new Date().toISOString(),
      stores,
      kpis: computeKPIs(inventory, stores, warehouseId),
      breakdown: computeWarehouseBreakdown(inventory, stores),
      lowStockProducts: computeLowStockProducts(
        inventory,
        products,
        warehouseId,
      ),
      topMost: computeTopProducts(inventory, products, warehouseId, 10, "most"),
      topLeast: computeTopProducts(
        inventory,
        products,
        warehouseId,
        10,
        "least",
      ),
      typeDistribution: computeProductTypeDistribution(
        inventory,
        products,
        warehouseId,
      ),
      stockComparison: computeStockComparison(inventory, stores),
    };
  }, [inventory, loading, products, stores, warehouseId]);

  useEffect(() => {
    onChange({ data, loading, error });
  }, [data, error, loading, onChange]);

  return null;
}
