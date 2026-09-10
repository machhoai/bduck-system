"use client";

import {
  ALL_REVENUE_WAREHOUSES,
  type RevenueDataSource,
} from "@bduck/shared-types";
import { useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import {
  getFacilityPermissionScope,
  scopeContainsFacility,
} from "@/utils/facilityPermissionScope";

import { useExternalStoreBindings } from "./useExternalStoreBindings";
import { useOpenApiRevenueWarehouses } from "./useOpenApiRevenueWarehouses";
import { useStores } from "./useWarehouses";

export function useRevenueStoreSelection(source: RevenueDataSource) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<
    Partial<Record<RevenueDataSource, string>>
  >({});
  const { stores, loading: storesLoading, error: storesError } = useStores();
  const {
    bindings,
    loading: bindingsLoading,
    error: bindingsError,
  } = useExternalStoreBindings();
  const {
    warehouseIds,
    loading: apiLoading,
    error: apiError,
  } = useOpenApiRevenueWarehouses();
  const permissions = useUserStore((state) => state.permissions);
  const sourceStores = useMemo(() => {
    const scope = getFacilityPermissionScope(permissions, ["revenue.read"]);
    const readable = stores.filter((store) =>
      scopeContainsFacility(scope, store.id),
    );
    if (source === "LOCAL_POS") return readable;
    if (bindingsError || apiError) return [];
    return readable.filter((store) => {
      const binding = bindings.find(
        (item) =>
          item.source_system === "JOYWORLD_LEGACY" &&
          item.member_warehouse_ids.includes(store.id),
      );
      return (
        (binding?.canonical_warehouse_id ?? store.id) === store.id &&
        warehouseIds.includes(store.id)
      );
    });
  }, [
    apiError,
    bindings,
    bindingsError,
    permissions,
    source,
    stores,
    warehouseIds,
  ]);
  const options = useMemo(() => {
    const stores = sourceStores.map((store) => ({
      id: store.id,
      name:
        source === "OPEN_API"
          ? bindings.find(
              (binding) => binding.canonical_warehouse_id === store.id,
            )?.display_name || store.name
          : store.name,
    }));
    return source === "LOCAL_POS" && stores.length > 0
      ? [
          { id: ALL_REVENUE_WAREHOUSES, name: t.revenue.filters.allWarehouses },
          ...stores,
        ]
      : stores;
  }, [bindings, source, sourceStores, t.revenue.filters.allWarehouses]);
  // Preserve the existing single-store default until the user selects ALL.
  const activeWarehouseId = options.some(
    (option) => option.id === selected[source],
  )
    ? selected[source]!
    : (sourceStores[0]?.id ?? "");
  const localWarehouseIds = useMemo(
    () =>
      source !== "LOCAL_POS"
        ? []
        : activeWarehouseId === ALL_REVENUE_WAREHOUSES
          ? sourceStores.map((store) => store.id)
          : activeWarehouseId
            ? [activeWarehouseId]
            : [],
    [activeWarehouseId, source, sourceStores],
  );

  return {
    activeWarehouseId,
    activeWarehouseName: options.find(
      (option) => option.id === activeWarehouseId,
    )?.name,
    localWarehouseIds,
    options,
    loading:
      storesLoading ||
      (source === "OPEN_API" && (bindingsLoading || apiLoading)),
    error:
      storesError || (source === "OPEN_API" ? bindingsError || apiError : null),
    selectWarehouse: (id: string) =>
      setSelected((current) => ({ ...current, [source]: id })),
  };
}
