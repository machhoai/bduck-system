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
import type { PaymentMethodMetric, RevenueChartPoint } from "@/hooks/useRevenueDashboard";
import { chartColors, donutColors, formatAxisValue, formatCurrency } from "./revenueDashboardUtils";

type MixedChartType = "bar" | "line";

interface RevenueChartsProps {
    points: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    onPointClick?: (key: string) => void;
}

export default function RevenueCharts({ points, paymentMethods, onPointClick }: RevenueChartsProps) {
    const { t } = useTranslation();
    const d = t.revenue;

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <div className="col-span-3 h-full">
                <RevenueMixedChart points={points} title={d.charts.revenueTitle} onPointClick={onPointClick} />
            </div>
            <div className="col-span-1 h-full">
                <PaymentDonutChart methods={paymentMethods} title={d.charts.paymentTitle} />
            </div>
            <div className="col-span-1 h-full">
                <ChartSummary points={points} />
            </div>
            <div className="col-span-3 h-full">
                <MemberCardChart points={points} title={d.charts.memberCardTitle} onPointClick={onPointClick} />
            </div>
        </div>
    );
}

/* ═══════════════ Revenue Mixed Chart ═══════════════ */

function RevenueMixedChart({ points, title, onPointClick }: { points: RevenueChartPoint[]; title: string; onPointClick?: (key: string) => void }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const data = useMemo<ChartData<MixedChartType, number[], string>>(
        () => ({
            labels: points.map((p) => p.label),
            datasets: [
                {
                    type: "bar",
                    label: d.charts.revenueBar,
                    data: points.map((p) => p.revenue),
                    backgroundColor: points.map((p) => (p.highlighted ? chartColors.amber : "rgba(0,102,204,0.6)")),
                    borderRadius: 6,
                    borderSkipped: "bottom",
                    order: 2,
                },
                {
                    type: "line",
                    label: d.charts.revenueLine,
                    data: points.map((p) => p.revenue),
                    borderColor: chartColors.green,
                    backgroundColor: "rgba(22,163,74,0.06)",
                    pointBackgroundColor: points.map((p) => (p.highlighted ? chartColors.amber : chartColors.green)),
                    pointRadius: points.map((p) => (p.highlighted ? 5 : 3)),
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.35,
                    order: 1,
                },
            ],
        }),
        [d.charts.revenueBar, d.charts.revenueLine, points],
    );

    const options = useMemo<ChartOptions<MixedChartType>>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: {
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
        [],
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

function MemberCardChart({ points, title, onPointClick }: { points: RevenueChartPoint[]; title: string; onPointClick?: (key: string) => void }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const data = useMemo<ChartData<"bar", number[], string>>(
        () => ({
            labels: points.map((p) => p.label),
            datasets: [{
                label: d.charts.memberCardBar,
                data: points.map((p) => p.memberCardAmount),
                backgroundColor: points.map((p) => (p.highlighted ? chartColors.amber : "rgba(22,163,74,0.6)")),
                borderRadius: 6,
            }],
        }),
        [d.charts.memberCardBar, points],
    );

    const options = useMemo<ChartOptions<"bar">>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: { ...chartTooltipOptions, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}` } },
                legend: { display: false },
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
        [],
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

function ChartSummary({ points }: { points: RevenueChartPoint[] }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const highlighted = points.filter((p) => p.highlighted);
    const total = highlighted.reduce((s, p) => s + p.revenue, 0);
    const orders = highlighted.reduce((s, p) => s + p.orderCount, 0);

    return (
        <div className="flex h-full flex-col justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryBox label={d.charts.highlightedDays} value={highlighted.length.toLocaleString("vi-VN")} />
                <SummaryBox label={d.stats.totalRevenue} value={formatCurrency(total)} highlight />
                <SummaryBox label={d.stats.totalOrders} value={orders.toLocaleString("vi-VN")} />
            </div>
        </div>
    );
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

function SummaryBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
            <p className={`mt-1 tabular-nums ${highlight ? "text-lg font-extrabold text-[var(--color-brand-primary)]" : "text-base font-bold text-[var(--color-text-primary)]"}`}>
                {value}
            </p>
        </div>
    );
}
