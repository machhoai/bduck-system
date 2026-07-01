"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
    chartAxisColor,
    chartGridColor,
    chartTooltipOptions,
    responsiveChartOptions,
} from "@/components/charts/chartjs";
import { useTranslation } from "@/lib/i18n";
import type { PaymentMethodMetric, RevenueChartPoint, RevenueDateMode } from "@/hooks/useRevenueDashboard";
import {
    chartColors,
    donutColors,
    formatAxisValue,
    formatCurrency,
    prepareComparableRevenuePoints,
    sumComparablePointValue,
    type ComparableRevenueChartPoint,
} from "./revenueDashboardUtils";

type MixedChartType = "bar" | "line";

interface RevenueChartsProps {
    currentPeriod: ComparisonPeriod;
    comparisonPeriods?: ComparisonPeriod[];
    points: RevenueChartPoint[];
    comparisonPoints?: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    mode: RevenueDateMode;
    comparisonLabel?: string;
    comparisonCount?: number;
    onPointClick?: (key: string) => void;
}

interface ComparisonPeriod {
    key: string;
    label: string;
    revenue: number;
    orderCount: number;
    memberCardAmount: number;
}

export default function RevenueCharts({
    currentPeriod,
    comparisonPeriods = [],
    points,
    comparisonPoints,
    paymentMethods,
    mode,
    comparisonLabel,
    comparisonCount = 0,
    onPointClick,
}: RevenueChartsProps) {
    const { t } = useTranslation();
    const d = t.revenue;
    const periodComparisonPoints = useMemo(
        () => buildPeriodComparisonPoints(currentPeriod, comparisonPeriods, comparisonCount > 1),
        [comparisonCount, comparisonPeriods, currentPeriod],
    );
    const prepared = useMemo(
        () => prepareComparableRevenuePoints(points, comparisonPoints, mode),
        [comparisonPoints, mode, points],
    );
    const usePeriodComparison = comparisonCount > 1 || (comparisonCount > 0 && mode === "date");
    const displayPoints = usePeriodComparison ? periodComparisonPoints : prepared.points;
    const chartVariant = usePeriodComparison ? "period" : "timeline";

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <div className="col-span-3 h-full">
                <RevenueMixedChart
                    points={displayPoints}
                    comparisonLabel={usePeriodComparison ? undefined : comparisonLabel}
                    variant={chartVariant}
                    title={d.charts.revenueTitle}
                    onPointClick={onPointClick}
                />
            </div>
            <div className="col-span-1 h-full">
                <PaymentDonutChart methods={paymentMethods} title={d.charts.paymentTitle} />
            </div>
            <div className="col-span-1 h-full">
                <ChartSummary points={displayPoints} />
            </div>
            <div className="col-span-3 h-full">
                <MemberCardChart
                    points={displayPoints}
                    comparisonLabel={usePeriodComparison ? undefined : comparisonLabel}
                    variant={chartVariant}
                    title={d.charts.memberCardTitle}
                    onPointClick={onPointClick}
                />
            </div>
        </div>
    );
}

function buildPeriodComparisonPoints(current: ComparisonPeriod, comparisonPeriods: ComparisonPeriod[], selectedOnly: boolean): ComparableRevenueChartPoint[] {
    const periods = selectedOnly ? comparisonPeriods : [current, ...comparisonPeriods];
    return periods.map((period, index) => ({
        key: period.key,
        label: period.label,
        tooltipLabel: period.label,
        revenue: period.revenue,
        orderCount: period.orderCount,
        memberCardAmount: period.memberCardAmount,
        highlighted: !selectedOnly && index === 0,
        tooltipRole: selectedOnly ? "selected" : index === 0 ? "current" : "comparison",
    }));
}

/* ═══════════════ Revenue Mixed Chart ═══════════════ */

function RevenueMixedChart({
    points,
    title,
    comparisonLabel,
    variant,
    onPointClick,
}: {
    points: ComparableRevenueChartPoint[];
    title: string;
    comparisonLabel?: string;
    variant: "timeline" | "period";
    onPointClick?: (key: string) => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const hasComparison = points.some((p) => typeof p.comparisonRevenue === "number");
    const data = useMemo<ChartData<MixedChartType, number[], string>>(
        () => ({
            labels: points.map((p) => p.label),
            datasets: [
                ...(hasComparison ? [{
                    type: "bar" as const,
                    label: withPeriodLabel(d.charts.comparisonRevenue, comparisonLabel),
                    data: points.map((p) => p.comparisonRevenue ?? 0),
                    backgroundColor: "rgba(100,116,139,0.24)",
                    borderRadius: 6,
                    borderSkipped: "bottom" as const,
                    order: 3,
                }] : []),
                {
                    type: "bar",
                    label: variant === "period" ? d.charts.selectedRevenue : d.charts.currentRevenue,
                    data: points.map((p) => p.revenue),
                    backgroundColor: points.map((p) => (p.highlighted ? chartColors.amber : "rgba(0,102,204,0.6)")),
                    borderRadius: 6,
                    borderSkipped: "bottom",
                    order: 2,
                },
                ...(variant === "timeline" ? [{
                    type: "line" as const,
                    label: d.charts.currentTrend,
                    data: points.map((p) => p.revenue),
                    borderColor: chartColors.green,
                    backgroundColor: "rgba(22,163,74,0.06)",
                    pointBackgroundColor: points.map((p) => (p.highlighted ? chartColors.amber : chartColors.green)),
                    pointRadius: points.map((p) => (p.highlighted ? 5 : 3)),
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.35,
                    order: 1,
                }] : []),
                ...(hasComparison ? [{
                    type: "line" as const,
                    label: withPeriodLabel(d.charts.comparisonTrend, comparisonLabel),
                    data: points.map((p) => p.comparisonRevenue ?? 0),
                    borderColor: chartColors.slate,
                    backgroundColor: "rgba(100,116,139,0.04)",
                    borderDash: [5, 5],
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    fill: false,
                    tension: 0.35,
                    order: 0,
                }] : []),
            ],
        }),
        [comparisonLabel, d.charts.comparisonRevenue, d.charts.comparisonTrend, d.charts.currentRevenue, d.charts.currentTrend, d.charts.selectedRevenue, hasComparison, points, variant],
    );

    const options = useMemo<ChartOptions<MixedChartType>>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: {
                        title: (items) => getTooltipTitle(
                            points[items[0]?.dataIndex],
                            isComparisonTooltip(items[0]?.dataset.label, comparisonLabel, d.charts.comparisonTrend),
                        ),
                        label: (ctx: TooltipItem<MixedChartType>) =>
                            `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}`,
                    },
                },
                legend: { labels: { color: chartAxisColor, boxWidth: 10, font: { size: 11 } } },
            },
            scales: {
                x: { ticks: { color: chartAxisColor, font: { size: 10 } }, grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { color: chartAxisColor, font: { size: 10 }, callback: (v) => formatAxisValue(Number(v)) },
                    grid: { color: chartGridColor },
                },
            },
        }),
        [comparisonLabel, d, points],
    );

    return (
        <ChartShell title={title} subtitle={d.charts.revenueSubtitle}>
            {points.length > 0 ? (
                <ChartCanvas
                    type="bar"
                    data={data}
                    options={options}
                    onElementClick={(index) => onPointClick?.(points[index]?.key)}
                />
            ) : <EmptyChart />}
        </ChartShell>
    );
}

/* ═══════════════ Payment Donut Chart ═══════════════ */

function PaymentDonutChart({ methods, title }: { methods: PaymentMethodMetric[]; title: string }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const labels = useMemo(
        () =>
            methods.map((m) =>
                m.method in d.paymentMethodLabels
                    ? d.paymentMethodLabels[m.method as keyof typeof d.paymentMethodLabels]
                    : m.method,
            ),
        [d.paymentMethodLabels, methods],
    );
    const data = useMemo<ChartData<"doughnut", number[], string>>(
        () => ({
            labels,
            datasets: [{
                data: methods.map((m) => m.amount),
                backgroundColor: methods.map((_, i) => donutColors[i % donutColors.length]),
                borderColor: "#fff",
                borderWidth: 3,
                hoverOffset: 8,
            }],
        }),
        [labels, methods],
    );

    const options = useMemo<ChartOptions<"doughnut">>(
        () => ({
            ...responsiveChartOptions,
            cutout: "68%",
            plugins: {
                tooltip: { ...chartTooltipOptions, callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(Number(ctx.raw))}` } },
                legend: { display: false },
            },
        }),
        [],
    );

    return (
        <ChartShell title={title} subtitle={d.charts.paymentSubtitle}>
            <div className="grid h-full grid-cols-1 gap-3">
                <div className="min-h-[210px]">{methods.length > 0 ? <ChartCanvas type="doughnut" data={data} options={options} /> : <EmptyChart />}</div>
                <div className="flex flex-col gap-1">
                    {methods.slice(0, 4).map((m, i) => (
                        <div key={m.method} className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] px-1 py-1 text-xs">
                            <span className="flex min-w-0 items-center gap-2 text-[var(--color-text-muted)]">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: donutColors[i % donutColors.length] }} />
                                <span className="truncate">{labels[i] ?? m.method}</span>
                            </span>
                            <span className="font-bold tabular-nums text-[var(--color-text-primary)]">{m.percentage.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </ChartShell>
    );
}

/* ═══════════════ Member Card Chart ═══════════════ */

function MemberCardChart({
    points,
    title,
    comparisonLabel,
    variant,
    onPointClick,
}: {
    points: ComparableRevenueChartPoint[];
    title: string;
    comparisonLabel?: string;
    variant: "timeline" | "period";
    onPointClick?: (key: string) => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const hasComparison = points.some((p) => typeof p.comparisonMemberCardAmount === "number");
    const data = useMemo<ChartData<"bar", number[], string>>(
        () => ({
            labels: points.map((p) => p.label),
            datasets: [
                {
                    label: variant === "period" ? d.charts.selectedMemberCard : d.charts.currentMemberCard,
                    data: points.map((p) => p.memberCardAmount),
                    backgroundColor: points.map((p) => (p.highlighted ? chartColors.amber : "rgba(22,163,74,0.6)")),
                    borderRadius: 6,
                },
                ...(hasComparison ? [{
                    label: withPeriodLabel(d.charts.comparisonMemberCard, comparisonLabel),
                    data: points.map((p) => p.comparisonMemberCardAmount ?? 0),
                    backgroundColor: "rgba(100,116,139,0.24)",
                    borderRadius: 6,
                }] : []),
            ],
        }),
        [comparisonLabel, d.charts.comparisonMemberCard, d.charts.currentMemberCard, d.charts.selectedMemberCard, hasComparison, points, variant],
    );

    const options = useMemo<ChartOptions<"bar">>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: {
                        title: (items) => getTooltipTitle(
                            points[items[0]?.dataIndex],
                            isComparisonTooltip(items[0]?.dataset.label, comparisonLabel, d.charts.comparisonMemberCard),
                        ),
                        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}`,
                    },
                },
                legend: { display: hasComparison, labels: { color: chartAxisColor, boxWidth: 10, font: { size: 11 } } },
            },
            scales: {
                x: { ticks: { color: chartAxisColor, font: { size: 10 } }, grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { color: chartAxisColor, font: { size: 10 }, callback: (v) => formatAxisValue(Number(v)) },
                    grid: { color: chartGridColor },
                },
            },
        }),
        [comparisonLabel, d, hasComparison, points],
    );

    return (
        <ChartShell title={title} subtitle={d.charts.memberCardSubtitle}>
            {points.length > 0 ? (
                <ChartCanvas
                    type="bar"
                    data={data}
                    options={options}
                    onElementClick={(index) => onPointClick?.(points[index]?.key)}
                />
            ) : <EmptyChart />}
        </ChartShell>
    );
}

/* ═══════════════ Chart Summary ═══════════════ */

function ChartSummary({ points }: { points: ComparableRevenueChartPoint[] }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const highlighted = points.filter((p) => p.highlighted);
    const scoped = highlighted.length > 0 ? highlighted : points;
    const revenue = sumComparablePointValue(scoped, "revenue");
    const orders = sumComparablePointValue(scoped, "orderCount");

    return (
        <div className="flex h-full flex-col justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryBox label={d.charts.highlightedDays} value={(highlighted.length || points.length).toLocaleString("vi-VN")} />
                <SummaryBox label={d.stats.totalRevenue} value={formatCurrency(revenue.current)} comparison={revenue.comparison ? formatCurrency(revenue.comparison) : undefined} highlight />
                <SummaryBox label={d.stats.totalOrders} value={orders.current.toLocaleString("vi-VN")} comparison={orders.comparison ? orders.comparison.toLocaleString("vi-VN") : undefined} />
            </div>
        </div>
    );
}

function isComparisonTooltip(label: string | undefined, comparisonLabel: string | undefined, comparisonLineLabel: string): boolean {
    if (!label) return false;
    if (label === comparisonLineLabel || label.startsWith(`${comparisonLineLabel} - `)) return true;
    return Boolean(comparisonLabel && label.includes(comparisonLabel));
}

function getTooltipTitle(point: ComparableRevenueChartPoint | undefined, comparison: boolean | undefined): string {
    if (!point) return "";
    if (comparison && point.comparisonTooltipLabel) return point.comparisonTooltipLabel;
    const label = point.tooltipLabel ?? formatPointLabel(point.key, point.label);
    return label;
}

function withPeriodLabel(label: string, period?: string): string {
    return period ? `${label} - ${period}` : label;
}

function formatPointLabel(key: string, fallback: string): string {
    if (fallback.includes(" - ")) return `Tuần ${fallback}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return `Ngày ${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
    if (/^\d{4}-\d{2}$/.test(key)) return `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`;
    return fallback || key;
}

/* ═══════════════ Chart Shell ═══════════════ */

function ChartShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <section className="flex h-full min-h-[360px] flex-col gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
            <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h2>
                <p className="text-xxs text-[var(--color-text-muted)]">{subtitle}</p>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
        </section>
    );
}

/* ═══════════════ Empty Chart ═══════════════ */

function EmptyChart() {
    const { t } = useTranslation();
    return (
        <div className="flex h-full min-h-[220px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)]">
            {t.common.noData}
        </div>
    );
}

/* ═══════════════ Summary Box ═══════════════ */

function SummaryBox({ label, value, comparison, highlight }: { label: string; value: string; comparison?: string; highlight?: boolean }) {
    return (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
            <p className={`mt-1 tabular-nums ${highlight ? "text-lg font-extrabold text-[var(--color-brand-primary)]" : "text-base font-bold text-[var(--color-text-primary)]"}`}>
                {value}
            </p>
            {comparison && (
                <p className="mt-1 truncate text-xxs font-semibold tabular-nums text-[var(--color-text-muted)]">
                    {comparison}
                </p>
            )}
        </div>
    );
}
