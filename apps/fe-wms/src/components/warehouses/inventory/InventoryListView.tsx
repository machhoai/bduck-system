"use client";

/**
 * InventoryListView — Compact list rows, mỗi row = 1 sản phẩm
 */

import type { InventoryRow } from "@/hooks/useInventoryFilter";
import { useTranslation } from "@/lib/i18n";
import { useProductPermissions } from "@/hooks/useProductPermissions";
import { Package } from "lucide-react";
import { ProductType } from "@bduck/shared-types";

interface InventoryListViewProps {
    rows: InventoryRow[];
}

const TYPE_COLORS: Record<string, string> = {
    [ProductType.EQUIPMENT]: "bg-blue-100 text-blue-700",
    [ProductType.SOUVENIR_SALE]: "bg-green-100 text-green-700",
    [ProductType.SOUVENIR_GIFT]: "bg-purple-100 text-purple-700",
};

export function InventoryListView({ rows }: InventoryListViewProps) {
    const { t } = useTranslation();
    const d = t.warehouses.inventoryView as Record<string, string>;
    const typeLabels = t.inventoryDashboard.productTypes as Record<string, string>;
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
        <div className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] overflow-hidden">
            {rows.map((row) => {
                const typeColor = TYPE_COLORS[row.product.product_type] ?? "bg-gray-100 text-gray-600";
                const hasAlerts = row.quarantine > 0;

                return (
                    <div
                        key={row.productId}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface-pearl)]"
                    >
                        {/* Product type dot */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xxs font-bold ${typeColor}`}>
                            {(typeLabels[row.product.product_type] ?? "?").slice(0, 2).toUpperCase()}
                        </div>

                        {/* Name + code */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                                    {row.product.name}
                                </span>
                                {hasAlerts && (
                                    <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-micro font-semibold text-red-600">
                                        {d.quarantine}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xxs text-[var(--color-text-muted)]">
                                <span>{row.product.code}</span>
                                <span>·</span>
                                <span>{row.product.unit}</span>
                                {canViewPrice && row.product.unit_price != null && (
                                    <>
                                        <span>·</span>
                                        <span>{row.product.unit_price.toLocaleString("vi-VN")}₫</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Stock pills */}
                        <div className="flex items-center gap-3 shrink-0">
                            {/* ATP — always shown */}
                            <div className="text-right">
                                <div className="text-sm font-semibold text-[var(--color-brand-primary)]">
                                    {row.atp.toLocaleString()}
                                </div>
                                <div className="text-xxs text-[var(--color-text-muted)]">{d.atp}</div>
                            </div>

                            {/* InTransit — only if > 0 */}
                            {row.inTransit > 0 && (
                                <div className="text-right">
                                    <div className="text-sm font-medium text-blue-600">
                                        {row.inTransit.toLocaleString()}
                                    </div>
                                    <div className="text-xxs text-[var(--color-text-muted)]">{d.inTransit}</div>
                                </div>
                            )}

                            {/* Quarantine — only if > 0 */}
                            {row.quarantine > 0 && (
                                <div className="text-right">
                                    <div className="text-sm font-medium text-red-600">
                                        {row.quarantine.toLocaleString()}
                                    </div>
                                    <div className="text-xxs text-[var(--color-text-muted)]">{d.quarantine}</div>
                                </div>
                            )}

                            {/* Total */}
                            <div className="text-right min-w-[48px]">
                                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                                    {row.total.toLocaleString()}
                                </div>
                                <div className="text-xxs text-[var(--color-text-muted)]">{d.total}</div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
