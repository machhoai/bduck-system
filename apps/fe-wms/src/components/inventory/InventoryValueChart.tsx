"use client";

/**
 * InventoryValueChart — KPI + phân tích giá trị tồn kho theo ProductType
 *
 * Kết hợp cả 2 phần:
 *  - KPI header: tổng giá trị ATP, coverage %, format gọn (tỷ/tr)
 *  - Bar chart: horizontal bars phân tích theo nhóm hàng
 *
 * RBAC: return null nếu không có permission "products.price.view".
 * Pure CSS bars — không dùng Recharts, chỉ 3 loại hàng.
 */

import { TrendingUp } from "lucide-react";
import { useProductPermissions } from "@/hooks/useProductPermissions";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";
import type { InventoryValueResult } from "@/utils/inventoryAggregation";
import { ProductType } from "@bduck/shared-types";

// ── Props ──────────────────────────────────────────────────────────────────

interface InventoryValueChartProps {
    data: InventoryValueResult;
    loading?: boolean;
}

// ── Color map theo ProductType ─────────────────────────────────────────────

const TYPE_COLOR: Record<string, { bar: string; badge: string }> = {
    [ProductType.EQUIPMENT]: {
        bar: "bg-blue-500",
        badge: "bg-blue-100 text-blue-700",
    },
    [ProductType.SOUVENIR_SALE]: {
        bar: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-700",
    },
    [ProductType.SOUVENIR_GIFT]: {
        bar: "bg-purple-500",
        badge: "bg-purple-100 text-purple-700",
    },
};

const DEFAULT_COLOR = {
    bar: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600",
};

// ── Format helpers ─────────────────────────────────────────────────────────

function fmtVND(value: number): string {
    if (value >= 1_000_000_000)
        return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ₫`;
    if (value >= 1_000_000)
        return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr₫`;
    return `${value.toLocaleString("vi-VN")}₫`;
}

function fmtShort(value: number): string {
    if (value >= 1_000_000_000)
        return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
    if (value >= 1_000_000)
        return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
    return value.toLocaleString("vi-VN");
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function InventoryValueSkeleton() {
    return (
        <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            {/* KPI header skeleton */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-12" variant="rect" />
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-32" variant="text" />
                    <Skeleton className="h-6 w-28" variant="text" />
                </div>
            </div>
            {/* Bars skeleton */}
            <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-20" variant="rect" />
                            <Skeleton className="h-4 w-16" variant="text" />
                        </div>
                        <Skeleton className="h-2.5 w-full" variant="rect" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function InventoryValueChart({ data, loading }: InventoryValueChartProps) {
    const { canViewPrice } = useProductPermissions();
    const { t } = useTranslation();
    const d = t.inventoryDashboard as Record<string, unknown>;
    const typeLabels = t.inventoryDashboard.productTypes as Record<string, string>;

    // RBAC guard — không có quyền xem giá → không render
    if (!canViewPrice) return null;

    if (loading) return <InventoryValueSkeleton />;

    const coveragePct =
        data.totalSkuCount > 0
            ? Math.round((data.coveredSkuCount / data.totalSkuCount) * 100)
            : 0;

    const sorted = [...data.valueByType].sort((a, b) => b.value - a.value);
    const maxValue = sorted[0]?.value ?? 1;

    return (
        <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-gradient-to-br from-[var(--color-surface-elevated)] to-emerald-50/40 p-5">

            {/* ── KPI Header ──────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                        style={{ backgroundColor: "#257a3e1a", color: "#257a3e" }}
                    >
                        <TrendingUp size={22} strokeWidth={1.7} />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-[var(--color-text-muted)]">
                            {(d.inventoryValue as string) ?? "Giá trị tồn kho (ATP)"}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold leading-none tracking-tight text-[var(--color-text-primary)]">
                            {fmtVND(data.totalValue)}
                        </p>
                        <p className="mt-1 text-xxs text-[var(--color-text-muted)]">
                            {data.coveredSkuCount}/{data.totalSkuCount} SKU{" "}
                            <span
                                className={`font-semibold ${coveragePct >= 80
                                    ? "text-[var(--color-accent-success)]"
                                    : "text-amber-600"
                                    }`}
                            >
                                ({coveragePct}%)
                            </span>{" "}
                            {(d.hasPriceLabel as string) ?? "có đơn giá"}
                        </p>
                    </div>
                </div>

                {/* Chart title */}
                <div className="text-right">
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                        {(d.inventoryValueChart as string) ?? "Phân tích giá trị"}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {(d.inventoryValueChartHint as string) ?? "ATP × Đơn giá theo nhóm hàng"}
                    </p>
                </div>
            </div>

            {/* ── Divider ──────────────────────────────────────────────── */}
            <div className="h-px w-full bg-[var(--color-border-subtle)]" />

            {/* ── Bars ─────────────────────────────────────────────────── */}
            {sorted.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">{t.common.noData}</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {sorted.map((item) => {
                        const colors = TYPE_COLOR[item.type] ?? DEFAULT_COLOR;
                        const barPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;

                        return (
                            <div key={item.type} className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${colors.badge}`}>
                                            {typeLabels[item.type] ?? item.type}
                                        </span>
                                        <span className="text-xxs text-[var(--color-text-muted)]">
                                            {item.percentage}%
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                                        {fmtShort(item.value)}₫
                                    </span>
                                </div>
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-card)]">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                                        style={{ width: `${barPct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Coverage warning ─────────────────────────────────────── */}
            {data.coveredSkuCount < data.totalSkuCount && (
                <p className="text-xxs text-amber-600">
                    ⚠ {data.totalSkuCount - data.coveredSkuCount} SKU chưa có đơn giá —{" "}
                    {(d.inventoryValueCoverageHint as string) ?? "giá trị thực tế có thể cao hơn"}
                </p>
            )}
        </div>
    );
}
