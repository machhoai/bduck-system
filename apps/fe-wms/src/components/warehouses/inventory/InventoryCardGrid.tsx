"use client";

/**
 * InventoryCardGrid — Grid layout cho card view
 */

import type { InventoryRow } from "@/hooks/useInventoryFilter";
import { useTranslation } from "@/lib/i18n";
import { InventoryProductCard } from "./InventoryProductCard";
import { Package } from "lucide-react";

interface InventoryCardGridProps {
    rows: InventoryRow[];
}

function CardSkeleton() {
    return (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
            <div className="h-32 animate-pulse bg-[var(--color-surface-card)]" />
            <div className="flex flex-col gap-2 p-3">
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-card)]" />
                <div className="h-5 w-full animate-pulse rounded bg-[var(--color-surface-card)]" />
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-surface-card)]" />
                <div className="h-14 animate-pulse rounded bg-[var(--color-surface-card)]" />
            </div>
        </div>
    );
}

export function InventoryCardGrid({ rows }: InventoryCardGridProps) {
    const { t } = useTranslation();
    const d = t.warehouses.inventoryView as Record<string, string>;

    if (rows.length === 0) {
        return (
            <div className="flex h-40 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
                <Package size={24} className="mb-2 opacity-50" />
                <span className="text-sm">{d.noResults}</span>
                <span className="mt-1 text-xs">{d.noResultsHint}</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rows.map((row) => (
                <InventoryProductCard key={row.productId} row={row} />
            ))}
        </div>
    );
}

/** Skeleton grid khi đang loading */
export function InventoryCardGridSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}
