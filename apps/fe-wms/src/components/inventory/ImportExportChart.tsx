"use client";

/**
 * ImportExportChart — Bar chart so sánh nhập/xuất kho theo khoảng thời gian.
 *
 * Time range options: 7 ngày | 30 ngày | 90 ngày | 12 tháng
 * Data sources: ImportVoucher (COMPLETED) + ExportVoucher (COMPLETED)
 * Lọc theo warehouseId.
 */

import { useMemo, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { useImportVouchers } from "@/hooks/useImportVouchers";
import { useExportVouchers } from "@/hooks/useExportVouchers";
import { ImportVoucherStatus, ExportVoucherStatus } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d" | "12m";

interface ChartDataPoint {
    label: string;
    import: number;
    export: number;
}

interface ImportExportChartProps {
    warehouseId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
    if (val instanceof Date) return val;
    if (typeof val === "string" || typeof val === "number") return new Date(val);
    if (val && typeof (val as { toDate?: () => Date }).toDate === "function") {
        return (val as { toDate: () => Date }).toDate();
    }
    return new Date();
}

function buildBuckets(
    range: Range,
    weekLabel: string,
    periodLabel: string,
): { label: string; from: Date; to: Date }[] {
    const now = new Date();
    const buckets: { label: string; from: Date; to: Date }[] = [];

    if (range === "7d") {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const to = new Date(from.getTime() + 86_400_000);
            buckets.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, from, to });
        }
    } else if (range === "30d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        let cursor = new Date(start);
        let week = 1;
        while (cursor <= now) {
            const from = new Date(cursor);
            const to = new Date(cursor.getTime() + 7 * 86_400_000);
            buckets.push({
                label: `${weekLabel} ${week++}`,
                from,
                to: to > now ? new Date(now.getTime() + 1) : to,
            });
            cursor = new Date(to);
        }
    } else if (range === "90d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 89);
        start.setHours(0, 0, 0, 0);
        let cursor = new Date(start);
        let period = 1;
        while (cursor <= now) {
            const from = new Date(cursor);
            const to = new Date(cursor.getTime() + 14 * 86_400_000);
            buckets.push({
                label: `${periodLabel}${period++}`,
                from,
                to: to > now ? new Date(now.getTime() + 1) : to,
            });
            cursor = new Date(to);
        }
    } else {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const from = d;
            const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
            buckets.push({
                label: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`,
                from,
                to,
            });
        }
    }

    return buckets;
}

// ── COMPONENT ──────────────────────────────────────────────────────────────

export default function ImportExportChart({ warehouseId }: ImportExportChartProps) {
    const { t } = useTranslation();
    const d = t.inventoryDashboard.importExportChart;

    const [range, setRange] = useState<Range>("30d");
    const { allVouchers: importVouchers, loading: importLoading } = useImportVouchers();
    const { completedVouchers: exportCompleted, activeVouchers: exportActive, loading: exportLoading } = useExportVouchers();

    const allExportVouchers = useMemo(
        () => [...exportCompleted, ...exportActive],
        [exportCompleted, exportActive],
    );

    const loading = importLoading || exportLoading;

    const chartData = useMemo<ChartDataPoint[]>(() => {
        const buckets = buildBuckets(range, d.weekLabel, d.periodLabel);

        const imports = importVouchers.filter(
            (v) => v.warehouse_id === warehouseId && v.status === ImportVoucherStatus.COMPLETED,
        );
        const exports = allExportVouchers.filter(
            (v) => v.warehouse_id === warehouseId && v.status === ExportVoucherStatus.COMPLETED,
        );

        return buckets.map(({ label, from, to }) => {
            const importCount = imports.filter((v) => {
                const dt = toDate(v.created_at);
                return dt >= from && dt < to;
            }).length;

            const exportCount = exports.filter((v) => {
                const dt = toDate(v.created_at);
                return dt >= from && dt < to;
            }).length;

            return { label, import: importCount, export: exportCount };
        });
    }, [range, importVouchers, allExportVouchers, warehouseId, d.weekLabel, d.periodLabel]);

    const isEmpty = !loading && chartData.every((pt) => pt.import === 0 && pt.export === 0);

    const rangeOptions: { value: Range; label: string }[] = [
        { value: "7d", label: d.rangeOptions["7d"] },
        { value: "30d", label: d.rangeOptions["30d"] },
        { value: "90d", label: d.rangeOptions["90d"] },
        { value: "12m", label: d.rangeOptions["12m"] },
    ];

    return (
        <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            {/* Header */}
            <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {d.title}
                </h3>

                {/* Range picker */}
                <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-0.5">
                    {rangeOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRange(opt.value)}
                            className={`h-6 rounded-md px-2.5 text-xxs font-semibold transition-all ${
                                range === opt.value
                                    ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart area */}
            {loading ? (
                <div className="flex flex-1 flex-col gap-3 pt-2">
                    {[80, 60, 90, 50, 70].map((w, i) => (
                        <div key={i} className="flex items-end gap-2">
                            <div
                                className="w-full animate-pulse rounded bg-[var(--color-surface-card)]"
                                style={{ height: `${w * 0.4}px` }}
                            />
                        </div>
                    ))}
                </div>
            ) : isEmpty ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-[var(--color-text-muted)]">{d.empty}</p>
                </div>
            ) : (
                <div className="min-h-[260px] flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            barCategoryGap="28%"
                            barGap={4}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="var(--color-border-subtle)"
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-border-subtle)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                    fontSize: "13px",
                                }}
                                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                            />
                            <Legend
                                height={28}
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: "12px", paddingTop: "4px" }}
                                formatter={(value) =>
                                    value === "import" ? d.import : d.export
                                }
                            />
                            <Bar
                                dataKey="import"
                                name="import"
                                fill="#0066cc"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={32}
                            />
                            <Bar
                                dataKey="export"
                                name="export"
                                fill="#16a34a"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={32}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
