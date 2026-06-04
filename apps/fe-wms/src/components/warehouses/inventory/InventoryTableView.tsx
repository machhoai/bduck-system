"use client";

/**
 * InventoryTableView — Table view (data-dense) với full i18n
 */

import type { InventoryRow } from "@/hooks/useInventoryFilter";
import { useTranslation } from "@/lib/i18n";
import { useProductPermissions } from "@/hooks/useProductPermissions";
import { Package } from "lucide-react";

interface InventoryTableViewProps {
    rows: InventoryRow[];
}

function StockBadge({ value, label, variant }: { value: number; label: string; variant: "warn" | "info" | "danger" }) {
    if (value <= 0) return <span className="text-[var(--color-text-muted)]">-</span>;
    const color = {
        warn: "text-amber-600",
        info: "text-blue-600",
        danger: "text-red-600",
    }[variant];
    return (
        <span className={`font-medium ${color}`}>
            {value.toLocaleString()}
        </span>
    );
}

export function InventoryTableView({ rows }: InventoryTableViewProps) {
    const { t } = useTranslation();
    const d = t.warehouses.inventoryView as Record<string, string>;
    const { canViewPrice } = useProductPermissions();

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
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
            <table className="w-full text-left">
                <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]">
                    <tr>
                        <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {t.warehouses.code}
                        </th>
                        <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {t.warehouses.name}
                        </th>
                        <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {d.unit}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-brand-primary)]">
                            {d.atp}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {d.onHold}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {d.inTransit}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xxs font-semibold uppercase tracking-wider text-red-500">
                            {d.quarantine}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {d.total}
                        </th>
                        {canViewPrice && (
                            <th className="px-3 py-2.5 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                {d.price}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {rows.map((row) => (
                        <tr key={row.productId} className="transition-colors hover:bg-[var(--color-surface-pearl)]">
                            <td className="px-3 py-2 font-medium text-[var(--color-text-primary)] text-sm">
                                {row.product.code}
                            </td>
                            <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                                <div>{row.product.name}</div>
                                {row.product.barcode && (
                                    <div className="text-xxs text-[var(--color-text-muted)]">{row.product.barcode}</div>
                                )}
                            </td>
                            <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                                {row.product.unit}
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-[var(--color-brand-primary)]">
                                {row.atp.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-sm">
                                <StockBadge value={row.onHold} label={d.onHold} variant="warn" />
                            </td>
                            <td className="px-3 py-2 text-right text-sm">
                                <StockBadge value={row.inTransit} label={d.inTransit} variant="info" />
                            </td>
                            <td className="px-3 py-2 text-right text-sm">
                                <StockBadge value={row.quarantine} label={d.quarantine} variant="danger" />
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-[var(--color-text-primary)]">
                                {row.total.toLocaleString()}
                            </td>
                            {canViewPrice && (
                                <td className="px-3 py-2 text-right text-xs text-[var(--color-text-muted)]">
                                    {row.product.unit_price != null
                                        ? row.product.unit_price.toLocaleString("vi-VN") + "₫"
                                        : "-"}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
