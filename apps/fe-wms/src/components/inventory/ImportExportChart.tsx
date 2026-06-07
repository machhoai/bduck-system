"use client";

/**
 * ImportExportChart — Bar chart so sánh nhập/xuất kho theo khoảng thời gian.
 *
 * Time range options: 7 ngày | 30 ngày | 90 ngày | 12 tháng
 * Data sources: ImportVoucher (COMPLETED) + ExportVoucher (COMPLETED)
 * Lọc theo warehouseId.
 */

import { useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
    chartAxisColor,
    chartGridColor,
    chartTooltipOptions,
    responsiveChartOptions,
} from "@/components/charts/chartjs";
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

    const barChartData: ChartData<"bar", number[], string> = {
        labels: chartData.map((item) => item.label),
        datasets: [
            {
                label: d.import,
                data: chartData.map((item) => item.import),
                backgroundColor: "#0066cc",
                borderRadius: 4,
                borderSkipped: "bottom",
                maxBarThickness: 32,
            },
            {
                label: d.export,
                data: chartData.map((item) => item.export),
                backgroundColor: "#16a34a",
                borderRadius: 4,
                borderSkipped: "bottom",
                maxBarThickness: 32,
            },
        ],
    };

    const barChartOptions: ChartOptions<"bar"> = {
        ...responsiveChartOptions,
        layout: {
            padding: { top: 4, right: 4, bottom: 0, left: 0 },
        },
        datasets: {
            bar: {
                barPercentage: 0.72,
                categoryPercentage: 0.72,
            },
        },
        plugins: {
            tooltip: chartTooltipOptions,
            legend: {
                position: "bottom",
                labels: {
                    boxHeight: 8,
                    boxWidth: 8,
                    font: { size: 12 },
                    padding: 12,
                    pointStyle: "circle",
                    usePointStyle: true,
                },
            },
        },
        scales: {
            x: {
                border: { display: false },
                grid: { display: false },
                ticks: { color: chartAxisColor, font: { size: 10 } },
            },
            y: {
                beginAtZero: true,
                border: { display: false },
                grid: { color: chartGridColor },
                ticks: {
                    color: chartAxisColor,
                    font: { size: 10 },
                    precision: 0,
                },
            },
        },
    };

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
                <div className="relative min-h-[260px] flex-1">
                    <ChartCanvas type="bar" data={barChartData} options={barChartOptions} />
                </div>
            )}
        </div>
    );
}
