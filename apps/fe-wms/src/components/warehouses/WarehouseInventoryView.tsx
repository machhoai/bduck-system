"use client";

/**
 * WarehouseInventoryView — Root component cho tab Mặt hàng tồn kho
 *
 * Orchestrates: useInventoryFilter hook + InventoryToolbar + 3 view modes
 * Thay thế WarehouseInventoryTable cũ trong page.tsx.
 */

import type { Inventory, Product } from "@bduck/shared-types";
import { useInventoryFilter } from "@/hooks/useInventoryFilter";
import { InventoryToolbar } from "./inventory/InventoryToolbar";
import { InventoryTableView } from "./inventory/InventoryTableView";
import { InventoryListView } from "./inventory/InventoryListView";
import { InventoryCardGrid } from "./inventory/InventoryCardGrid";
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { useMemo } from "react";

interface WarehouseInventoryViewProps {
    inventory: Inventory[];
    products: Product[];
    warehouseId: string;
    loading?: boolean;
}

/** Skeleton cho toolbar + 1 view placeholder */
function InventoryViewSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {/* toolbar skeleton */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
                <div className="flex items-center gap-2">
                    <div className="h-8 flex-1 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]" />
                    <div className="h-8 w-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]" />
                </div>
                <div className="mt-2 flex gap-2">
                    {[80, 72, 88, 96].map((w, i) => (
                        <div key={i} className="h-8 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]" style={{ width: `${w}px` }} />
                    ))}
                </div>
            </div>
            {/* table skeleton */}
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="h-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]" />
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3">
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
    warehouseId,
    loading = false,
}: WarehouseInventoryViewProps) {
    const {
        filters,
        filteredRows,
        totalRows,
        updateFilter,
        resetFilters,
        hasActiveFilters,
    } = useInventoryFilter(inventory, products, warehouseId);



    const exportConfig = useMemo(() => {
        if (!filteredRows.length) return null;
        return {
            filename: `inventory_warehouse_${warehouseId}`,
            entityType: "inventory",
            warehouseId,
            filters,
            data: filteredRows,
            columns: [
                { header: "Mã SP", key: "product_code", width: 20, format: (_v: any, row: any) => row.product.code },
                { header: "Tên sản phẩm", key: "product_name", width: 30, format: (_v: any, row: any) => row.product.name },
                { header: "Loại SP", key: "product_type", width: 20, format: (_v: any, row: any) => row.product.product_type },
                { header: "Mã vạch", key: "product_barcode", width: 20, format: (_v: any, row: any) => row.product.barcode || "" },
                { header: "Warehouse ID", key: "warehouse_id", width: 35, format: () => warehouseId },
                { header: "Product ID", key: "product_id", width: 35, format: (_v: any, row: any) => row.productId },
                { header: "Tổng số lượng", key: "total_quantity", width: 15, format: (_v: any, row: any) => row.total },
                { header: "Khả dụng (ATP)", key: "atp_quantity", width: 15, format: (_v: any, row: any) => row.atp },
                { header: "Tạm giữ", key: "on_hold_quantity", width: 15, format: (_v: any, row: any) => row.onHold },
                { header: "Chờ xuất", key: "in_transit_quantity", width: 15, format: (_v: any, row: any) => row.inTransit },
                { header: "Cách ly (Lỗi)", key: "quarantine_quantity", width: 15, format: (_v: any, row: any) => row.quarantine },
                { header: "Đơn vị", key: "unit", width: 15, format: (_v: any, row: any) => row.product.unit },
            ],
        };
    }, [filteredRows, filters, warehouseId]);

    useExportRegistration(exportConfig);

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
            {filters.viewMode === "list" && (
                <InventoryListView rows={filteredRows} />
            )}
            {filters.viewMode === "card" && (
                <InventoryCardGrid rows={filteredRows} />
            )}
        </div>
    );
}
