"use client";

/**
 * InventoryToolbar — Search / Filter / Sort / ViewMode switcher
 *
 * Props là controlled state từ useInventoryFilter hook.
 */

import { LayoutGrid, List, Table2, X } from "lucide-react";
import type {
    InventoryFilterState,
    SortField,
    SortDir,
    StockStatus,
    ViewMode,
} from "@/hooks/useInventoryFilter";
import { ProductType, ProductOrigin } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface InventoryToolbarProps {
    filters: InventoryFilterState;
    totalRows: number;
    filteredCount: number;
    hasActiveFilters: boolean;
    onUpdate: <K extends keyof InventoryFilterState>(
        key: K,
        value: InventoryFilterState[K],
    ) => void;
    onReset: () => void;
}

const VIEW_MODES: {
    mode: ViewMode;
    Icon: typeof Table2;
    labelKey: "viewTable" | "viewList" | "viewCard";
}[] = [
        { mode: "card", Icon: LayoutGrid, labelKey: "viewCard" },
        { mode: "list", Icon: List, labelKey: "viewList" },
        { mode: "table", Icon: Table2, labelKey: "viewTable" },
    ];

export function InventoryToolbar({
    filters,
    totalRows,
    filteredCount,
    hasActiveFilters,
    onUpdate,
    onReset,
}: InventoryToolbarProps) {
    const { t } = useTranslation();
    const d = t.warehouses.inventoryView as Record<string, string>;

    const productTypeOptions = [
        { value: "", label: d.allTypes },
        {
            value: ProductType.EQUIPMENT,
            label: (t.inventoryDashboard.productTypes as Record<string, string>)
                .EQUIPMENT,
        },
        {
            value: ProductType.SOUVENIR_SALE,
            label: (t.inventoryDashboard.productTypes as Record<string, string>)
                .SOUVENIR_SALE,
        },
        {
            value: ProductType.SOUVENIR_GIFT,
            label: (t.inventoryDashboard.productTypes as Record<string, string>)
                .SOUVENIR_GIFT,
        },
    ];

    const originOptions = [
        { value: "", label: d.allOrigins },
        { value: ProductOrigin.DOMESTIC, label: "Nội địa" },
        { value: ProductOrigin.INTERNATIONAL, label: "Nhập khẩu" },
    ];

    const stockStatusOptions: { value: StockStatus; label: string }[] = [
        { value: "all", label: d.stockAll },
        { value: "available", label: d.stockAvailable },
        { value: "zero", label: d.stockZero },
        { value: "quarantine", label: d.stockQuarantine },
    ];

    const sortOptions: { value: SortField; label: string }[] = [
        { value: "total", label: d.sortTotal },
        { value: "atp", label: d.sortAtp },
        { value: "name", label: d.sortName },
        { value: "price", label: d.sortPrice },
    ];

    const selectCls =
        "h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]";

    return (
        <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
            {/* Row 1: search + view toggle */}
            <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => onUpdate("search", e.target.value)}
                        placeholder={d.searchPlaceholder}
                        className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] pl-3 pr-8 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    />
                    {filters.search && (
                        <button
                            type="button"
                            onClick={() => onUpdate("search", "")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-0.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-0.5">
                    {VIEW_MODES.map(({ mode, Icon, labelKey }) => (
                        <button
                            key={mode}
                            type="button"
                            title={d[labelKey]}
                            onClick={() => onUpdate("viewMode", mode)}
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${filters.viewMode === mode
                                    ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            <Icon size={14} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Row 2: filters + sort + results count */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Product Type */}
                <select
                    value={filters.productType}
                    onChange={(e) =>
                        onUpdate("productType", e.target.value as ProductType | "")
                    }
                    className={selectCls}
                >
                    {productTypeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>

                {/* Origin */}
                <select
                    value={filters.productOrigin}
                    onChange={(e) =>
                        onUpdate("productOrigin", e.target.value as ProductOrigin | "")
                    }
                    className={selectCls}
                >
                    {originOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>

                {/* Stock status */}
                <select
                    value={filters.stockStatus}
                    onChange={(e) =>
                        onUpdate("stockStatus", e.target.value as StockStatus)
                    }
                    className={selectCls}
                >
                    {stockStatusOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>

                {/* Sort */}
                <div className="flex items-center gap-1">
                    <select
                        value={filters.sortBy}
                        onChange={(e) => onUpdate("sortBy", e.target.value as SortField)}
                        className={selectCls}
                    >
                        {sortOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        title={filters.sortDir === "asc" ? d.desc : d.asc}
                        onClick={() =>
                            onUpdate("sortDir", filters.sortDir === "asc" ? "desc" : "asc")
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
                    >
                        {filters.sortDir === "asc" ? "↑" : "↓"}
                    </button>
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex h-8 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-2 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                    >
                        <X size={12} />
                        {d.clearFilters}
                    </button>
                )}

                {/* Results count */}
                <span className="ml-auto text-xxs text-[var(--color-text-muted)]">
                    {filteredCount}/{totalRows} {d.results}
                </span>
            </div>
        </div>
    );
}
