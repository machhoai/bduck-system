"use client";

/**
 * ExpenseDashboard — Full analytics dashboard for expenses
 *
 * Style: Mirrors main inventory dashboard (rounded-lg cards, var() colors)
 * Charts: Chart.js
 *  - Expense Trend: mixed bar + line chart
 *  - Revenue vs Expense: mixed bar + filled line chart
 *  - Expense Allocation: doughnut chart with segment spacing
 *  - Top Expenses: table with mode switcher
 *
 * Currency: always full number, e.g. 20.000.000đ (never abbreviated)
 */

import { useState } from "react";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
    chartAxisColor,
    chartGridColor,
    chartTooltipOptions,
    responsiveChartOptions,
} from "@/components/charts/chartjs";
import { useTranslation } from "@/lib/i18n";
import {
    useExpenseDashboardMetrics,
    type DashboardKPI,
    type CostCenterStat,
    type TopExpenseItem,
} from "@/hooks/useExpenseDashboardMetrics";
import { ExpenseCostCenter } from "@bduck/shared-types";
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    Factory,
    Megaphone,
    ShoppingBag,
    SquareAsterisk,
    TrendingDown,
    TrendingUp,
    Users,
    X,
    DollarSign,
    Receipt,
    PiggyBank,
    Percent,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import {
    CurrencyNumberFlow,
    PercentNumberFlow,
} from "@/components/ui/NumberFlowValue";
import { useRevenueSync } from "@/hooks/useRevenueSync";
import { RefreshCw, Clock } from "lucide-react";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const EMPTY_KPI: DashboardKPI = { value: 0, prevValue: 0, trend: 0 };

const COST_CENTER_ICONS: Record<ExpenseCostCenter, typeof Factory> = {
    [ExpenseCostCenter.OPERATIONS]: Factory,
    [ExpenseCostCenter.HR]: Users,
    [ExpenseCostCenter.MARKETING]: Megaphone,
    [ExpenseCostCenter.MERCHANDISE]: ShoppingBag,
    [ExpenseCostCenter.OTHERS]: SquareAsterisk,
};

const COST_CENTER_STYLE: Record<ExpenseCostCenter, { color: string; bg: string }> = {
    [ExpenseCostCenter.OPERATIONS]: { color: "#0066cc", bg: "#0066cc1a" },
    [ExpenseCostCenter.HR]: { color: "#6366f1", bg: "#6366f11a" },
    [ExpenseCostCenter.MARKETING]: { color: "#f59e0b", bg: "#f59e0b1a" },
    [ExpenseCostCenter.MERCHANDISE]: { color: "#257a3e", bg: "#257a3e1a" },
    [ExpenseCostCenter.OTHERS]: { color: "#7a7a7a", bg: "#7a7a7a1a" },
};

const PIE_COLORS = ["#0066cc", "#6366f1", "#f59e0b", "#257a3e", "#7a7a7a"];

const KPI_CONFIGS = [
    { icon: DollarSign, color: "#0066cc", bg: "#0066cc1a" },
    { icon: Receipt, color: "#b42318", bg: "#b423181a" },
    { icon: PiggyBank, color: "#257a3e", bg: "#257a3e1a" },
    { icon: Percent, color: "#6366f1", bg: "#6366f11a" },
] as const;

type TopExpenseMode = "highest" | "increased" | "lowest";

/** Full currency — 20.000.000đ, never abbreviated */
function formatCurrency(value: number): string {
    return `${value.toLocaleString("vi-VN")}đ`;
}

/** Short axis label — 20tr, 1.5 tỷ for chart Y axis only */
function formatAxisValue(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}tỷ`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}tr`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return String(value);
}

type MixedExpenseChartType = "bar" | "line";

function formatCurrencyTooltip(ctx: TooltipItem<MixedExpenseChartType>): string {
    return `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}`;
}

// ─────────────────────────────────────────────
// Animated Number Component
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// KPI Card (matches StatCard from main dashboard)
// ─────────────────────────────────────────────

export function KPICard({ title, kpi, index }: {
    title: string;
    kpi: DashboardKPI;
    suffix?: string;
    index: number;
}) {
    const cfg = KPI_CONFIGS[index] || KPI_CONFIGS[0];
    const Icon = cfg.icon;
    const trendUp = kpi.trend > 0;
    const TrendIcon = trendUp ? TrendingUp : TrendingDown;
    const isProfit = index === 2;
    const trendColor = isProfit
        ? (trendUp ? "#257a3e" : "#b42318")
        : (trendUp ? "#b42318" : "#257a3e");

    return (
        <div className="group w-full rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5 text-left transition-all hover:shadow-md">
            <div className="mb-3 flex items-center gap-3">
                <div
                    className="flex h-8 w-10 items-center justify-center rounded-[var(--radius-sm)]"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                    <Icon size={20} strokeWidth={1.7} />
                </div>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">{title}</span>
            </div>
            <div className="flex items-end justify-between gap-2">
                <p className="text-lg font-semibold leading-none tracking-tight text-[var(--color-text-primary)]">
                    {index === 3 ? (
                        <PercentNumberFlow value={kpi.value} />
                    ) : (
                        <CurrencyNumberFlow value={kpi.value} />
                    )}
                </p>
                {kpi.trend !== 0 && (
                    <span
                        className="inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-micro font-bold tabular-nums"
                        style={{ color: trendColor, backgroundColor: `${trendColor}14` }}
                    >
                        <TrendIcon size={10} strokeWidth={2.5} />
                        <PercentNumberFlow value={Math.abs(kpi.trend)} />
                    </span>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Cost Center Stat Card (clickable)
// ─────────────────────────────────────────────

function CostCenterStatCard({ stat, label, onClick }: {
    stat: CostCenterStat;
    label: string;
    onClick: () => void;
}) {
    const Icon = COST_CENTER_ICONS[stat.costCenter];
    const style = COST_CENTER_STYLE[stat.costCenter];
    const isOver = stat.usagePercent > 100;
    const trendUp = stat.trend > 0;

    return (
        <button
            type="button"
            onClick={onClick}
            className="group w-full rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 text-left transition-all hover:border-[var(--color-brand-primary)] hover:shadow-md active:scale-[0.98]"
        >
            <div className="mb-2 flex items-center gap-2">
                <div
                    className="flex h-7 w-8 items-center justify-center rounded-[var(--radius-sm)]"
                    style={{ backgroundColor: style.bg, color: style.color }}
                >
                    <Icon size={16} strokeWidth={1.7} />
                </div>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-text-primary)]">
                    {label}
                </span>
                {stat.trend !== 0 && (
                    <span
                        className="shrink-0 text-micro font-bold tabular-nums"
                        style={{ color: trendUp ? "#b42318" : "#257a3e" }}
                    >
                        {trendUp ? "+" : ""}{stat.trend.toFixed(1)}%
                    </span>
                )}
            </div>
            <p className="mb-2 text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                {formatCurrency(stat.actualTotal)}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-card)]">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${Math.min(stat.usagePercent, 100)}%`,
                        backgroundColor: isOver ? "#b42318" : style.color,
                    }}
                />
            </div>
            <div className="mt-1 flex justify-between text-micro tabular-nums text-[var(--color-text-muted)]">
                <span>{formatCurrency(stat.budgetTotal)}</span>
                <span>{stat.usagePercent.toFixed(0)}%</span>
            </div>
        </button>
    );
}

// ─────────────────────────────────────────────
// Cost Center Detail Modal
// ─────────────────────────────────────────────

function CostCenterDetailModal({ stat, label, onClose, t }: {
    stat: CostCenterStat;
    label: string;
    onClose: () => void;
    t: ReturnType<typeof useTranslation>["t"];
}) {
    const Icon = COST_CENTER_ICONS[stat.costCenter];
    const style = COST_CENTER_STYLE[stat.costCenter];
    const isOver = stat.usagePercent > 100;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-[90%] max-w-[500px] rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]"
                            style={{ backgroundColor: style.bg, color: style.color }}
                        >
                            <Icon size={16} />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                            {t.expenses.dashboard.groupDetail}: {label}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: t.expenses.dashboard.actual, value: formatCurrency(stat.actualTotal), color: undefined },
                            { label: t.expenses.dashboard.budget, value: formatCurrency(stat.budgetTotal), color: undefined },
                            { label: t.expenses.dashboard.usage, value: `${stat.usagePercent.toFixed(1)}%`, color: isOver ? "#b42318" : "#257a3e" },
                        ].map((item) => (
                            <div key={item.label} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3 text-center">
                                <p className="text-xxs text-[var(--color-text-muted)]">{item.label}</p>
                                <p className="text-sm font-bold tabular-nums" style={item.color ? { color: item.color } : undefined}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-base)]">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${Math.min(stat.usagePercent, 100)}%`,
                                backgroundColor: isOver ? "#b42318" : style.color,
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
                        <span className="text-xs text-[var(--color-text-muted)]">{t.expenses.dashboard.change} MoM</span>
                        <span
                            className="ml-auto text-sm font-bold tabular-nums"
                            style={{ color: stat.trend > 0 ? "#b42318" : "#257a3e" }}
                        >
                            {stat.trend > 0 ? "+" : ""}{stat.trend.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Expense Trend — mixed bar + line chart
// ─────────────────────────────────────────────

export function ExpenseTrendChart({ data, title, subtitle, t }: {
    data: { month: string; revenue: number; expenses: number }[];
    title: string;
    subtitle: string;
    t: ReturnType<typeof useTranslation>["t"];
}) {
    if (!data || data.length === 0) {
        return (
            <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <p className="mt-1 text-xxs text-[var(--color-text-muted)]">{subtitle}</p>
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-[var(--color-text-muted)]">{t.common.noData}</p>
                </div>
            </div>
        );
    }

    // Add % change to data
    const enriched = data.map((d, i) => ({
        ...d,
        change: i > 0 && data[i - 1].expenses > 0
            ? ((d.expenses - data[i - 1].expenses) / data[i - 1].expenses * 100)
            : 0,
    }));

    const chartData: ChartData<MixedExpenseChartType, number[], string> = {
        labels: enriched.map((item) => item.month),
        datasets: [
            {
                type: "bar",
                label: "Chi phí",
                data: enriched.map((item) => item.expenses),
                backgroundColor: "rgba(180, 35, 24, 0.7)",
                borderRadius: 4,
                borderSkipped: "bottom",
                maxBarThickness: 32,
                order: 2,
            },
            {
                type: "line",
                label: "Xu hướng",
                data: enriched.map((item) => item.expenses),
                borderColor: "#b42318",
                borderWidth: 2,
                fill: false,
                pointBackgroundColor: "#b42318",
                pointHoverRadius: 5,
                pointRadius: 3,
                tension: 0.35,
                order: 1,
            },
        ],
    };

    const chartOptions: ChartOptions<MixedExpenseChartType> = {
        ...responsiveChartOptions,
        layout: {
            padding: { top: 4, right: 4, bottom: 0, left: 0 },
        },
        datasets: {
            bar: {
                barPercentage: 0.7,
                categoryPercentage: 0.72,
            },
        },
        plugins: {
            tooltip: {
                ...chartTooltipOptions,
                callbacks: {
                    label: formatCurrencyTooltip,
                },
            },
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
                    callback: (value) => formatAxisValue(Number(value)),
                    color: chartAxisColor,
                    font: { size: 10 },
                    precision: 0,
                },
            },
        },
    };

    return (
        <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            <div className="mb-4 shrink-0">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">{subtitle}</p>
            </div>
            <div className="relative min-h-[260px] flex-1">
                <ChartCanvas type="bar" data={chartData} options={chartOptions} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Revenue vs Expense — mixed bar + filled line chart
// ─────────────────────────────────────────────

function RevenueExpenseChart({ data, title, t }: {
    data: { month: string; revenue: number; expenses: number; net: number }[];
    title: string;
    t: ReturnType<typeof useTranslation>["t"];
}) {
    if (!data || data.length === 0) {
        return (
            <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-[var(--color-text-muted)]">{t.common.noData}</p>
                </div>
            </div>
        );
    }

    const chartData: ChartData<MixedExpenseChartType, number[], string> = {
        labels: data.map((item) => item.month),
        datasets: [
            {
                type: "line",
                label: "Lợi nhuận",
                data: data.map((item) => item.net),
                backgroundColor: "rgba(37, 122, 62, 0.15)",
                borderColor: "rgba(37, 122, 62, 0)",
                borderWidth: 0,
                fill: "origin",
                pointRadius: 0,
                tension: 0.35,
                order: 4,
            },
            {
                type: "bar",
                label: "Doanh thu",
                data: data.map((item) => item.revenue),
                backgroundColor: "rgba(0, 102, 204, 0.8)",
                borderRadius: 4,
                borderSkipped: "bottom",
                maxBarThickness: 28,
                order: 3,
            },
            {
                type: "bar",
                label: "Chi phí",
                data: data.map((item) => item.expenses),
                backgroundColor: "rgba(180, 35, 24, 0.7)",
                borderRadius: 4,
                borderSkipped: "bottom",
                maxBarThickness: 28,
                order: 3,
            },
            {
                type: "line",
                label: "Lợi nhuận ròng",
                data: data.map((item) => item.net),
                borderColor: "#257a3e",
                borderWidth: 2,
                fill: false,
                pointBackgroundColor: "#257a3e",
                pointHoverRadius: 5,
                pointRadius: 3,
                tension: 0.35,
                order: 1,
            },
        ],
    };

    const chartOptions: ChartOptions<MixedExpenseChartType> = {
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
            tooltip: {
                ...chartTooltipOptions,
                callbacks: {
                    label: formatCurrencyTooltip,
                },
            },
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
                    callback: (value) => formatAxisValue(Number(value)),
                    color: chartAxisColor,
                    font: { size: 10 },
                    precision: 0,
                },
            },
        },
    };

    return (
        <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            <h3 className="mb-4 shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">
                {title}
            </h3>
            <div className="relative min-h-[260px] flex-1">
                <ChartCanvas type="bar" data={chartData} options={chartOptions} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Donut Chart — doughnut with gap & rounded corners
// ─────────────────────────────────────────────

export function AllocationDonutChart({ data, title, costCenterLabels, t }: {
    data: { costCenter: string; amount: number; percentage: number; color: string }[];
    title: string;
    costCenterLabels: Record<string, string>;
    t: ReturnType<typeof useTranslation>["t"];
}) {
    const total = data.reduce((sum, s) => sum + s.amount, 0);

    const chartData = data.map((item, i) => ({
        name: costCenterLabels[item.costCenter] || item.costCenter,
        value: item.amount,
        fill: PIE_COLORS[i % PIE_COLORS.length],
    }));

    const doughnutData: ChartData<"doughnut", number[], string> = {
        labels: chartData.map((item) => item.name),
        datasets: [
            {
                data: chartData.map((item) => item.value),
                backgroundColor: chartData.map((item) => item.fill),
                borderRadius: 6,
                borderWidth: 0,
                spacing: 4,
            },
        ],
    };

    const doughnutOptions: ChartOptions<"doughnut"> = {
        ...responsiveChartOptions,
        cutout: "62%",
        plugins: {
            tooltip: {
                ...chartTooltipOptions,
                callbacks: {
                    label: (ctx: TooltipItem<"doughnut">) =>
                        `${ctx.label}: ${formatCurrency(Number(ctx.raw))}`,
                },
            },
            legend: {
                position: "bottom",
                labels: {
                    boxHeight: 8,
                    boxWidth: 8,
                    font: { size: 13 },
                    padding: 14,
                    pointStyle: "circle",
                    usePointStyle: true,
                },
            },
        },
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-[var(--color-text-muted)]">{t.common.noData}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <span className="text-xxs font-bold tabular-nums text-[var(--color-text-primary)]">
                    {formatCurrency(total)}
                </span>
            </div>
            <div className="relative min-h-[300px] flex-1">
                <ChartCanvas type="doughnut" data={doughnutData} options={doughnutOptions} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Top Expenses Table
// ─────────────────────────────────────────────

function TopExpensesTable({ items, t }: {
    items: TopExpenseItem[];
    t: ReturnType<typeof useTranslation>["t"];
}) {
    const [mode, setMode] = useState<TopExpenseMode>("highest");

    const sorted = [...items].sort((a, b) => {
        if (mode === "highest") return b.amount - a.amount;
        if (mode === "increased") return b.changePercent - a.changePercent;
        return a.amount - b.amount;
    }).slice(0, 10);

    const modes: { key: TopExpenseMode; label: string }[] = [
        { key: "highest", label: t.expenses.dashboard.topHighest },
        { key: "increased", label: t.expenses.dashboard.topIncreased },
        { key: "lowest", label: t.expenses.dashboard.topLowest },
    ];

    return (
        <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t.expenses.dashboard.topExpenses}
                </h3>
                <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-0.5">
                    {modes.map((m) => (
                        <button
                            key={m.key}
                            type="button"
                            onClick={() => setMode(m.key)}
                            className={`h-6 rounded-md px-2.5 text-xxs font-semibold transition-all ${mode === m.key
                                ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto">
                {sorted.map((item, i) => {
                    const isPositiveChange = item.changePercent > 0;
                    return (
                        <div key={item.category} className="flex items-center gap-3 rounded-[var(--radius-sm)] p-2 transition-colors hover:bg-[var(--color-surface-card)]">
                            <span className="w-5 text-center text-xxs font-bold tabular-nums text-[var(--color-text-muted)]">
                                {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{item.label}</p>
                                <p className="text-micro text-[var(--color-text-muted)]">
                                    {t.expenses.costCenter[item.costCenter as keyof typeof t.expenses.costCenter] || item.costCenter}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                                    {formatCurrency(item.amount)}
                                </p>
                                {item.changePercent !== 0 && (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-micro font-bold tabular-nums"
                                        style={{ color: isPositiveChange ? "#b42318" : "#257a3e" }}
                                    >
                                        {isPositiveChange ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                                        {Math.abs(item.changePercent).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
                {sorted.length === 0 && (
                    <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{t.common.noData}</p>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Over Budget Alerts
// ─────────────────────────────────────────────

function OverBudgetAlerts({ stores, title, emptyText }: {
    stores: { warehouseName: string; budgetUsed: number; totalBudget: number; totalActual: number }[];
    title: string;
    emptyText: string;
}) {
    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                {stores.length > 0 && (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-micro font-bold" style={{ color: "#b42318", backgroundColor: "#b423181a" }}>
                        <AlertTriangle size={10} />
                        {stores.length}
                    </span>
                )}
            </div>
            {stores.length === 0 ? (
                <p className="py-3 text-center text-xs text-[var(--color-text-muted)]">{emptyText}</p>
            ) : (
                <div className="grid gap-2 lg:grid-cols-2">
                    {stores.map((store) => {
                        const isOver = store.budgetUsed > 100;
                        return (
                            <div key={store.warehouseName} className="rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{store.warehouseName}</span>
                                    <span className="text-xxs font-bold tabular-nums" style={{ color: isOver ? "#b42318" : "#257a3e" }}>
                                        {store.budgetUsed}%
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-base)]">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${Math.min(store.budgetUsed, 100)}%`,
                                            backgroundColor: isOver ? "#b42318" : "#257a3e",
                                        }}
                                    />
                                </div>
                                <div className="mt-1.5 flex justify-between text-micro tabular-nums text-[var(--color-text-muted)]">
                                    <span>{formatCurrency(store.totalBudget)}</span>
                                    <span>{formatCurrency(store.totalActual)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// Dashboard Skeleton (matches main dashboard)
// ─────────────────────────────────────────────

function DashboardSkeleton() {
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                        <div className="mb-3 flex items-center gap-3">
                            <Skeleton className="h-8 w-10" variant="rect" />
                            <Skeleton className="h-4 w-24" variant="text" />
                        </div>
                        <Skeleton className="h-8 w-28" variant="text" />
                    </div>
                ))}
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                        <Skeleton className="mb-2 h-5 w-24" variant="text" />
                        <Skeleton className="h-6 w-32" variant="text" />
                        <Skeleton className="mt-2 h-1.5 w-full" variant="rect" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                    <Skeleton className="mb-4 h-5 w-40" variant="text" />
                    <Skeleton className="h-[260px] w-full" variant="rect" />
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                    <Skeleton className="mb-4 h-5 w-40" variant="text" />
                    <Skeleton className="mx-auto h-[200px] w-[200px]" variant="circle" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function ExpenseDashboard({
    warehouseId,
    period,
}: {
    warehouseId: string;
    period: string;
}) {
    const { t } = useTranslation();
    const { metrics, loading, error } = useExpenseDashboardMetrics(warehouseId, period);
    const { revenue: revenueSync, syncing, syncTime } = useRevenueSync(period, warehouseId);
    const [selectedCostCenter, setSelectedCostCenter] = useState<ExpenseCostCenter | null>(null);

    // Override KPIs with JoyWorld real-time revenue when available
    const joyRevenue = revenueSync?.total_revenue ?? 0;
    const hasJoyRevenue = joyRevenue > 0;

    const grossRevenueKPI: DashboardKPI = hasJoyRevenue
        ? { value: joyRevenue, prevValue: metrics.grossRevenue?.prevValue ?? 0, trend: metrics.grossRevenue?.prevValue ? ((joyRevenue - (metrics.grossRevenue?.prevValue ?? 0)) / (metrics.grossRevenue?.prevValue || 1)) * 100 : 0 }
        : (metrics.grossRevenue ?? EMPTY_KPI);

    const totalExpensesKPI = metrics.totalExpenses ?? EMPTY_KPI;

    const netProfitValue = hasJoyRevenue
        ? joyRevenue - totalExpensesKPI.value
        : (metrics.netProfit?.value ?? 0);
    const netProfitKPI: DashboardKPI = hasJoyRevenue
        ? { value: netProfitValue, prevValue: metrics.netProfit?.prevValue ?? 0, trend: metrics.netProfit?.prevValue ? ((netProfitValue - (metrics.netProfit?.prevValue ?? 0)) / Math.abs(metrics.netProfit?.prevValue || 1)) * 100 : 0 }
        : (metrics.netProfit ?? EMPTY_KPI);

    const profitMarginValue = hasJoyRevenue && joyRevenue > 0
        ? (netProfitValue / joyRevenue) * 100
        : (metrics.profitMargin?.value ?? 0);
    const profitMarginKPI: DashboardKPI = hasJoyRevenue
        ? { value: profitMarginValue, prevValue: metrics.profitMargin?.prevValue ?? 0, trend: metrics.profitMargin?.prevValue ? profitMarginValue - (metrics.profitMargin?.prevValue ?? 0) : 0 }
        : (metrics.profitMargin ?? EMPTY_KPI);

    const selectedStat = selectedCostCenter
        ? metrics.costCenterStats?.find((s) => s.costCenter === selectedCostCenter) ?? null
        : null;

    if (error) {
        return (
            <div className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border p-4" style={{ borderColor: "#b4231833", backgroundColor: "#b4231808" }}>
                <AlertTriangle size={16} style={{ color: "#b42318" }} />
                <span className="text-xs" style={{ color: "#b42318" }}>{error}</span>
            </div>
        );
    }

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="flex w-full flex-col gap-4">
            {/* ── KPI Cards ── */}
            <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
                <KPICard title={t.expenses.dashboard.grossRevenue} kpi={grossRevenueKPI} suffix="đ" index={0} />
                <KPICard title={t.expenses.dashboard.totalExpenses} kpi={totalExpensesKPI} suffix="đ" index={1} />
                <KPICard title={t.expenses.dashboard.netProfit} kpi={netProfitKPI} suffix="đ" index={2} />
                <KPICard title={t.expenses.dashboard.profitMargin} kpi={profitMarginKPI} suffix="%" index={3} />
            </div>

            {/* ── Revenue Sync Status Badge ── */}
            {/* <div className="flex items-center gap-2 text-xxs text-[var(--color-text-muted)]">
        {syncing ? (
          <>
            <RefreshCw size={12} className="animate-spin" />
            <span>{t.expenses.dashboard.syncing || "Đang đồng bộ doanh thu..."}</span>
          </>
        ) : syncTime ? (
          <>
            <Clock size={12} />
            <span>
              {t.expenses.dashboard.lastSync || "Đồng bộ doanh thu lúc"}:{" "}
              {syncTime.toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </>
        ) : (
          <>
            <Clock size={12} />
            <span>{t.expenses.dashboard.notSynced || "Chưa đồng bộ doanh thu"}</span>
          </>
        )}
        {revenueSync && (
          <span className="ml-auto text-xxs font-semibold tabular-nums text-[var(--color-brand-primary)]">
            {t.expenses.dashboard.joyWorldRevenue || "JoyWorld"}: {formatCurrency(revenueSync.total_revenue)}
          </span>
        )}
      </div> */}

            {/* ── Cost Center Stats ── */}
            {metrics.costCenterStats?.length > 0 && (
                <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {t.expenses.dashboard.costCenterStats}
                    </h3>
                    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                        {metrics.costCenterStats.map((stat) => (
                            <CostCenterStatCard
                                key={stat.costCenter}
                                stat={stat}
                                label={t.expenses.costCenter[stat.costCenter] || stat.costCenter}
                                onClick={() => setSelectedCostCenter(stat.costCenter)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Charts Row 1: Trend + Donut ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <ExpenseTrendChart
                    data={hasJoyRevenue
                        ? (metrics.trendData ?? []).map((d) => {
                            const monthNum = period.split("-")[1];
                            const label = `T${parseInt(monthNum, 10)}`;
                            if (d.month === label) {
                                return { ...d, revenue: joyRevenue };
                            }
                            return d;
                        })
                        : (metrics.trendData ?? [])
                    }
                    title={t.expenses.dashboard.expenseTrend}
                    subtitle={t.expenses.dashboard.expenseTrendDesc}
                    t={t}
                />
                <AllocationDonutChart
                    data={metrics.costCenterBreakdown ?? []}
                    title={t.expenses.dashboard.expenseBreakdown}
                    costCenterLabels={t.expenses.costCenter}
                    t={t}
                />
            </div>

            {/* ── Charts Row 2: Revenue vs Expense + Top Expenses ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <RevenueExpenseChart
                    data={hasJoyRevenue
                        ? (metrics.revenueExpenseMonthly ?? []).map((d) => {
                            // Override revenue for the current period month
                            const monthNum = period.split("-")[1];
                            const label = `T${parseInt(monthNum, 10)}`;
                            if (d.month === label) {
                                return { ...d, revenue: joyRevenue, net: joyRevenue - d.expenses };
                            }
                            return d;
                        })
                        : (metrics.revenueExpenseMonthly ?? [])
                    }
                    title={t.expenses.dashboard.revenueVsExpenseMonthly}
                    t={t}
                />
                <TopExpensesTable items={metrics.topExpenses ?? []} t={t} />
            </div>

            {/* ── Over Budget (only ALL mode) ── */}
            {warehouseId === "ALL" && (
                <OverBudgetAlerts
                    stores={metrics.overBudgetStores ?? []}
                    title={t.expenses.dashboard.overBudgetStores}
                    emptyText={t.expenses.dashboard.noOverBudget}
                />
            )}

            {/* ── Cost Center Detail Modal ── */}
            {selectedStat && (
                <CostCenterDetailModal
                    stat={selectedStat}
                    label={t.expenses.costCenter[selectedStat.costCenter] || selectedStat.costCenter}
                    onClose={() => setSelectedCostCenter(null)}
                    t={t}
                />
            )}
        </div>
    );
}
