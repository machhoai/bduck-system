"use client";

import { useMemo, useState } from "react";
import type {
  ExportVoucher,
  ImportVoucher,
  Inventory,
  Product,
  ProductCategory,
  Warehouse,
  WarehouseLocation,
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import { StockPolicyScope } from "@bduck/shared-types";
import { useInventoryFilter } from "@/hooks/useInventoryFilter";
import { useStockPolicies } from "@/hooks/useStockPolicies";
import { InventoryToolbar } from "./inventory/InventoryToolbar";
import { InventoryTableView } from "./inventory/InventoryTableView";
import { InventoryListView } from "./inventory/InventoryListView";
import { InventoryCardGrid } from "./inventory/InventoryCardGrid";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

interface WarehouseInventoryViewProps {
  inventory: Inventory[];
  products: Product[];
  categories?: ProductCategory[];
  warehouses?: Warehouse[];
  locations: WarehouseLocation[];
  slots?: WarehouseLocationSlot[];
  slotMappings?: WarehouseLocationSlotProduct[];
  importVouchers?: ImportVoucher[];
  exportVouchers?: ExportVoucher[];
  warehouseId: string;
  loading?: boolean;
}

function InventoryViewSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 flex-1 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]" />
          <div className="h-8 w-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]" />
        </div>
        <div className="mt-2 flex gap-2">
          {[80, 72, 88, 96].map((w, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
        <div className="h-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-card)]" />
            <div className="h-4 flex-1 animate-pulse rounded bg-[var(--color-surface-card)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-card)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-card)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WarehouseInventoryView({
  inventory,
  products,
  categories = [],
  warehouses = [],
  locations,
  slots = [],
  slotMappings = [],
  importVouchers = [],
  exportVouchers = [],
  warehouseId,
  loading = false,
}: WarehouseInventoryViewProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const {
    filters,
    filteredRows,
    totalRows,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  } = useInventoryFilter(inventory, products, warehouseId, locations);
  const { policies } = useStockPolicies({
    warehouseId,
    scope: StockPolicyScope.WAREHOUSE,
  });
  const policyByProductId = useMemo(
    () => new Map(policies.map((policy) => [policy.product_id, policy])),
    [policies],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  if (loading) {
    return <InventoryViewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-3">
      <InventoryToolbar
        filters={filters}
        totalRows={totalRows}
        filteredCount={filteredRows.length}
        hasActiveFilters={hasActiveFilters}
        onUpdate={updateFilter}
        onReset={resetFilters}
      />

      {filters.viewMode === "table" && (
        <InventoryTableView rows={filteredRows} />
      )}
      {filters.viewMode === "list" && <InventoryListView rows={filteredRows} />}
      {filters.viewMode === "card" && (
        <InventoryCardGrid
          rows={filteredRows}
          policyByProductId={policyByProductId}
          onViewDetails={(row) => setSelectedProduct(row.product)}
        />
      )}
      <ProductDetailModal
        isOpen={selectedProduct !== null}
        product={selectedProduct}
        category={
          selectedProduct ? categoryById.get(selectedProduct.category_id) : null
        }
        inventory={inventory}
        warehouses={warehouses}
        locations={locations}
        slots={slots}
        slotMappings={slotMappings}
        importVouchers={importVouchers}
        exportVouchers={exportVouchers}
        warehouseId={warehouseId}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
