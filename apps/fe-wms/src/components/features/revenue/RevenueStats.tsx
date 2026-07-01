"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import {
    Banknote,
    CircleDollarSign,
    CreditCard,
    Gift,
    MonitorCog,
    ReceiptText,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
    Users,
    X,
} from "lucide-react";
import type { PaymentMethodMetric, RevenueDashboardData, RevenueMetric } from "@/hooks/useRevenueDashboard";
import ChartCanvas from "@/components/charts/ChartCanvas";
import { chartAxisColor, chartGridColor, chartTooltipOptions, responsiveChartOptions } from "@/components/charts/chartjs";
import { useTranslation } from "@/lib/i18n";
import {
    chartColors,
    formatAxisValue,
    formatCurrency,
    formatNumber,
    getMetricTone,
    getPaymentTotal,
    donutColors,
    prepareComparableRevenuePoints,
    type ComparableRevenueChartPoint,
} from "./revenueDashboardUtils";

type StatKey =
    | "totalRevenue"
    | "totalOrders"
    | "averageOrderValue"
    | "memberCardSales"
    | "deviceConsumption"
    | "memberCount"
    | "memberStoredBalance"
    | "memberGiftBalance"
    | "paymentMethods";

interface RevenueStatsProps {
    data: RevenueDashboardData;
    comparisonData?: RevenueDashboardData | null;
    comparisonLabel?: string;
}

const statIcons = {
    totalRevenue: Banknote,
    totalOrders: ShoppingCart,
    averageOrderValue: ReceiptText,
    memberCardSales: CreditCard,
    deviceConsumption: MonitorCog,
    memberCount: Users,
    memberStoredBalance: CircleDollarSign,
    memberGiftBalance: Gift,
    paymentMethods: Banknote,
};

export default function RevenueStats({ data, comparisonData, comparisonLabel }: RevenueStatsProps) {
    const { t } = useTranslation();
    const d = t.revenue;
    const [selected, setSelected] = useState<StatKey | null>(null);
    const comparisonEnabled = Boolean(comparisonData);

    const cards: {
        key: StatKey;
        label: string;
        value: number;
        formatValue: (v: number) => string;
        metric?: RevenueMetric;
        hint: string;
    }[] = [
            {
                key: "totalRevenue",
                label: d.stats.totalRevenue,
                value: data.stats.totalRevenue.value,
                formatValue: formatCurrency,
                metric: data.stats.totalRevenue,
                hint: d.stats.revenueHint,
            },
            {
                key: "totalOrders",
                label: d.stats.totalOrders,
                value: data.stats.totalOrders.value,
                formatValue: formatNumber,
                metric: data.stats.totalOrders,
                hint: d.stats.ordersHint,
            },
            {
                key: "averageOrderValue",
                label: d.stats.averageOrderValue,
                value: data.stats.averageOrderValue.value,
                formatValue: formatCurrency,
                metric: data.stats.averageOrderValue,
                hint: d.stats.aovHint,
            },
            {
                key: "memberCardSales",
                label: d.stats.memberCardSales,
                value: data.stats.memberCardSales.value,
                formatValue: formatCurrency,
                metric: data.stats.memberCardSales,
                hint: d.stats.memberHint,
            },
            {
                key: "deviceConsumption",
                label: d.stats.deviceConsumption,
                value: data.stats.deviceConsumption.value,
                formatValue: formatNumber,
                metric: data.stats.deviceConsumption,
                hint: d.stats.deviceHint,
            },
            {
                key: "memberCount",
                label: d.stats.memberCount,
                value: data.stats.memberCount.value,
                formatValue: formatNumber,
                metric: data.stats.memberCount,
                hint: d.stats.memberCountHint,
            },
            {
                key: "memberStoredBalance",
                label: d.stats.memberStoredBalance,
                value: data.stats.memberStoredBalance.value,
                formatValue: formatCurrency,
                metric: data.stats.memberStoredBalance,
                hint: d.stats.memberBalanceHint,
            },
            {
                key: "memberGiftBalance",
                label: d.stats.memberGiftBalance,
                value: data.stats.memberGiftBalance.value,
                formatValue: formatCurrency,
                metric: data.stats.memberGiftBalance,
                hint: d.stats.memberGiftHint,
            },
        ];

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                    <StatCard
                        key={card.key}
                        card={card}
                        icon={statIcons[card.key]}
                        isHero={card.key === "totalRevenue"}
                        showTrend={comparisonEnabled}
                        onClick={() => setSelected(card.key)}
                    />
                ))}
            </div>

            {selected && (
                <StatDetailModal
                    selected={selected}
                    data={data}
                    comparisonData={comparisonData}
                    comparisonLabel={comparisonLabel}
                    onClose={() => setSelected(null)}
                />
            )}
        </>
    );
}

/* ═══════════════ Animated Number ═══════════════ */

function AnimatedNumber({ value, formatValue }: { value: number; formatValue: (v: number) => string }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const start = displayValue;
        const end = value;
        if (start === end) return;

        const duration = 900;
        const startTime = performance.now();
        let frameId = 0;

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplayValue(start + (end - start) * eased);
            if (progress < 1) {
                frameId = requestAnimationFrame(animate);
            } else {
                setDisplayValue(end);
            }
        };

        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [value]);

    return <>{formatValue(displayValue)}</>;
}

/* ═══════════════ Stat Card ═══════════════ */

function StatCard({
    card,
    icon: Icon,
    isHero,
    showTrend,
    onClick,
}: {
    card: { key: StatKey; label: string; value: number; formatValue: (v: number) => string; metric?: RevenueMetric; hint: string };
    icon: typeof Banknote;
    isHero: boolean;
    showTrend: boolean;
    onClick: () => void;
}) {
    const tone = card.metric ? getMetricTone(card.metric) : "flat";
    const TrendIcon = tone === "down" ? TrendingDown : TrendingUp;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group flex flex-col gap-1 rounded-[var(--radius-lg)] p-3 text-left transition-all cursor-pointer duration-150 active:scale-[0.98] ${isHero
                ? "bg-[var(--color-brand-primary)] text-white shadow-sm hover:shadow-md"
                : "bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-card)]"
                }`}
        >
            {/* Label row */}
            <div className="flex items-center gap-2">
                <Icon
                    size={15}
                    strokeWidth={1.8}
                    className={isHero ? "opacity-70" : "text-[var(--color-text-muted)]"}
                />
                <span className={`truncate text-xs font-medium tracking-wide ${isHero ? "opacity-80" : "text-[var(--color-text-muted)]"}`}>
                    {card.label}
                </span>
            </div>

            {/* Hero number */}
            <p className={`truncate tabular-nums ${isHero
                ? "text-2xl font-bold"
                : "text-lg font-bold text-[var(--color-text-primary)]"
                }`}>
                <AnimatedNumber value={card.value} formatValue={card.formatValue} />
            </p>

            {/* Hint + trend */}
            <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-xxs ${isHero ? "opacity-60" : "text-[var(--color-text-muted)]"}`}>
                    {card.hint}
                </span>
                {showTrend && card.metric && (
                    <TrendBadge tone={tone} percent={card.metric.changePercent} icon={TrendIcon} isHero={isHero} />
                )}
            </div>
        </button>
    );
}

function TrendBadge({
    tone,
    percent,
    icon: TrendIcon,
    isHero,
}: {
    tone: "up" | "down" | "flat";
    percent: number;
    icon: typeof TrendingUp;
    isHero: boolean;
}) {
    if (isHero) {
        const heroBg = tone === "up" ? "rgba(255,255,255,0.2)" : tone === "down" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.15)";
        return (
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xxs font-bold tabular-nums text-white" style={{ backgroundColor: heroBg }}>
                <TrendIcon size={10} />
                {Math.abs(percent).toFixed(1)}%
            </span>
        );
    }

    const cls =
        tone === "up"
            ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
            : tone === "down"
                ? "bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]";

    return (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xxs font-bold tabular-nums ${cls}`}>
            <TrendIcon size={10} />
            {Math.abs(percent).toFixed(1)}%
        </span>
    );
}

/* ═══════════════ Stat Detail Modal ═══════════════ */

function StatDetailModal({
    selected,
    data,
    comparisonData,
    comparisonLabel,
    onClose,
}: {
    selected: StatKey;
    data: RevenueDashboardData;
    comparisonData?: RevenueDashboardData | null;
    comparisonLabel?: string;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const paymentTotal = getPaymentTotal(data.stats.paymentMethods);
    const title = d.stats[selected];
    const metric = selected === "paymentMethods" ? undefined : data.stats[selected];
    const hasComparison = Boolean(comparisonData);
    const comparisonText =
        data.comparisonLabel in d.comparison
            ? d.comparison[data.comparisonLabel as keyof typeof d.comparison]
            : data.comparisonLabel;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4 shadow-2xl sm:w-[760px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {d.detail.compareWith} {comparisonText}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)]"
                        aria-label={d.actions.close}
                    >
                        <X size={16} />
                    </button>
                </div>

                {metric && <MetricDetail metric={metric} selected={selected} showComparison={hasComparison} />}

                {selected !== "paymentMethods" && metric && comparisonData && (
                    <>
                        <MetricComparisonChart
                            selected={selected}
                            metric={metric}
                            comparisonMetric={comparisonData?.stats[selected]}
                            comparisonLabel={comparisonLabel || comparisonText}
                        />
                        <MetricTrendChart
                            selected={selected}
                            data={data}
                            comparisonData={comparisonData}
                            comparisonLabel={comparisonLabel || comparisonText}
                        />
                    </>
                )}

                {selected === "paymentMethods" && comparisonData && (
                    <PaymentMethodsComparisonChart
                        current={data.stats.paymentMethods}
                        comparison={comparisonData?.stats.paymentMethods}
                        comparisonLabel={comparisonLabel || comparisonText}
                    />
                )}

                {(selected === "totalRevenue" || selected === "paymentMethods") && (
                    <div className="flex flex-col gap-2">
                        {data.stats.paymentMethods.map((method, index) => (
                            <PaymentRow
                                key={method.method}
                                method={method}
                                label={getTranslatedPaymentLabel(d, method.method)}
                                total={paymentTotal}
                                colorIndex={index}
                            />
                        ))}
                        {data.stats.paymentMethods.length === 0 && (
                            <p className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3 text-sm text-[var(--color-text-muted)]">
                                {d.empty.noPayment}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════════ Metric Detail ═══════════════ */

function MetricComparisonChart({
    selected,
    metric,
    comparisonMetric,
    comparisonLabel,
}: {
    selected: Exclude<StatKey, "paymentMethods">;
    metric: RevenueMetric;
    comparisonMetric?: RevenueMetric;
    comparisonLabel: string;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const formatValue = getStatFormatter(selected);
    const comparisonValue = comparisonMetric?.value ?? metric.previousValue;
    const data = useMemo<ChartData<"bar", number[], string>>(
        () => ({
            labels: [d.detail.current, comparisonLabel],
            datasets: [{
                label: d.stats[selected],
                data: [metric.value, comparisonValue],
                backgroundColor: [chartColors.blue, "rgba(100,116,139,0.35)"],
                borderRadius: 6,
            }],
        }),
        [comparisonLabel, comparisonValue, d.detail.current, d.stats, metric.value, selected],
    );
    const options = useMemo<ChartOptions<"bar">>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatValue(Number(ctx.raw))}` },
                },
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
        [formatValue],
    );

    return (
        <div className="h-[240px] rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <ChartCanvas type="bar" data={data} options={options} />
        </div>
    );
}

function MetricTrendChart({
    selected,
    data,
    comparisonData,
    comparisonLabel,
}: {
    selected: Exclude<StatKey, "paymentMethods">;
    data: RevenueDashboardData;
    comparisonData?: RevenueDashboardData | null;
    comparisonLabel: string;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const formatValue = getStatFormatter(selected);
    const prepared = useMemo(
        () => prepareComparableRevenuePoints(data.charts.points, comparisonData?.charts.points, data.mode),
        [comparisonData?.charts.points, data.charts.points, data.mode],
    );
    const values = useMemo(() => getTrendValues(selected, prepared.points), [prepared.points, selected]);

    if (!values) return null;

    const chartData: ChartData<"bar" | "line", number[], string> = {
        labels: prepared.points.map((point) => point.label),
        datasets: [
            {
                type: "bar",
                label: d.detail.current,
                data: values.current,
                backgroundColor: "rgba(0,102,204,0.58)",
                borderRadius: 6,
                order: 2,
            },
            {
                type: "line",
                label: comparisonLabel,
                data: values.comparison,
                borderColor: chartColors.slate,
                backgroundColor: "rgba(100,116,139,0.08)",
                borderDash: [5, 5],
                pointRadius: 2,
                pointHoverRadius: 5,
                tension: 0.35,
                order: 1,
            },
        ],
    };
    const options: ChartOptions<"bar" | "line"> = {
        ...responsiveChartOptions,
        plugins: {
            tooltip: {
                ...chartTooltipOptions,
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatValue(Number(ctx.raw))}` },
            },
            legend: { labels: { color: chartAxisColor, boxWidth: 10, font: { size: 11 } } },
        },
        scales: {
            x: { ticks: { color: chartAxisColor, font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
            y: {
                beginAtZero: true,
                ticks: { color: chartAxisColor, font: { size: 10 }, callback: (v) => formatAxisValue(Number(v)) },
                grid: { color: chartGridColor },
            },
        },
    };

    return (
        <div className="h-[260px] rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[var(--color-text-primary)]">{d.detail.trend}</p>
                <p className="truncate text-xxs font-semibold text-[var(--color-text-muted)]">{comparisonLabel}</p>
            </div>
            <div className="h-[220px]">
                <ChartCanvas type="bar" data={chartData} options={options} />
            </div>
        </div>
    );
}

function PaymentMethodsComparisonChart({
    current,
    comparison,
    comparisonLabel,
}: {
    current: PaymentMethodMetric[];
    comparison?: PaymentMethodMetric[];
    comparisonLabel: string;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const rows = useMemo(() => {
        const comparisonByMethod = new Map((comparison ?? []).map((item) => [item.method, item]));
        return current.map((item) => ({
            method: item.method,
            current: item.amount,
            comparison: comparisonByMethod.get(item.method)?.amount ?? 0,
        }));
    }, [comparison, current]);
    const data = useMemo<ChartData<"bar", number[], string>>(
        () => ({
            labels: rows.map((row) => getTranslatedPaymentLabel(d, row.method)),
            datasets: [
                {
                    label: d.detail.current,
                    data: rows.map((row) => row.current),
                    backgroundColor: "rgba(0,102,204,0.58)",
                    borderRadius: 6,
                },
                {
                    label: comparisonLabel,
                    data: rows.map((row) => row.comparison),
                    backgroundColor: "rgba(100,116,139,0.30)",
                    borderRadius: 6,
                },
            ],
        }),
        [comparisonLabel, d, rows],
    );
    const options = useMemo<ChartOptions<"bar">>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}` },
                },
                legend: { labels: { color: chartAxisColor, boxWidth: 10, font: { size: 11 } } },
            },
            scales: {
                x: { ticks: { color: chartAxisColor, font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { color: chartAxisColor, font: { size: 10 }, callback: (v) => formatAxisValue(Number(v)) },
                    grid: { color: chartGridColor },
                },
            },
        }),
        [],
    );

    if (rows.length === 0) return null;

    return (
        <div className="h-[260px] rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <ChartCanvas type="bar" data={data} options={options} />
        </div>
    );
}

function getTrendValues(
    selected: Exclude<StatKey, "paymentMethods">,
    points: ComparableRevenueChartPoint[],
): { current: number[]; comparison: number[] } | null {
    if (selected === "totalRevenue") {
        return {
            current: points.map((point) => point.revenue),
            comparison: points.map((point) => point.comparisonRevenue ?? 0),
        };
    }
    if (selected === "totalOrders") {
        return {
            current: points.map((point) => point.orderCount),
            comparison: points.map((point) => point.comparisonOrderCount ?? 0),
        };
    }
    if (selected === "averageOrderValue") {
        return {
            current: points.map((point) => (point.orderCount > 0 ? point.revenue / point.orderCount : 0)),
            comparison: points.map((point) => {
                const orders = point.comparisonOrderCount ?? 0;
                return orders > 0 ? (point.comparisonRevenue ?? 0) / orders : 0;
            }),
        };
    }
    if (selected === "memberCardSales") {
        return {
            current: points.map((point) => point.memberCardAmount),
            comparison: points.map((point) => point.comparisonMemberCardAmount ?? 0),
        };
    }
    return null;
}

function getStatFormatter(selected: Exclude<StatKey, "paymentMethods">): (value: number) => string {
    if (selected === "totalOrders" || selected === "deviceConsumption" || selected === "memberCount") return formatNumber;
    return formatCurrency;
}

function MetricDetail({ metric, selected, showComparison }: { metric: RevenueMetric; selected: StatKey; showComparison: boolean }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const tone = getMetricTone(metric);
    const color = tone === "up" ? "var(--color-success-text)" : tone === "down" ? "var(--color-error-text)" : "var(--color-neutral-500)";
    const fmtVal = selected === "totalOrders" || selected === "deviceConsumption" || selected === "memberCount"
        ? formatNumber
        : formatCurrency;

    return (
        <div className={`grid grid-cols-1 gap-3 ${showComparison ? "sm:grid-cols-3" : ""}`}>
            <DetailBox label={d.detail.current} value={fmtVal(metric.value)} bold />
            {showComparison && (
                <>
                    <DetailBox label={d.detail.previous} value={fmtVal(metric.previousValue)} />
                    <DetailBox
                        label={d.detail.change}
                        value={`${metric.changePercent > 0 ? "+" : ""}${metric.changePercent.toFixed(1)}%`}
                        color={color}
                    />
                </>
            )}
        </div>
    );
}

function DetailBox({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
    return (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
            <p
                className={`mt-2 tabular-nums text-[var(--color-text-primary)] ${bold ? "text-base font-extrabold" : "text-sm font-bold"}`}
                style={color ? { color } : undefined}
            >
                {value}
            </p>
        </div>
    );
}

/* ═══════════════ Payment Row ═══════════════ */

function PaymentRow({ method, label, total, colorIndex }: { method: PaymentMethodMetric; label: string; total: number; colorIndex: number }) {
    const percentage = total > 0 ? (method.amount / total) * 100 : method.percentage;
    const barColor = donutColors[colorIndex % donutColors.length];

    return (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
                    <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                    {formatCurrency(method.amount)}
                </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xxs text-[var(--color-text-muted)]">
                <span>{formatNumber(method.orderCount)}</span>
                <span className="font-semibold">{percentage.toFixed(1)}%</span>
            </div>
        </div>
    );
}

/* ═══════════════ i18n helper ═══════════════ */

function getTranslatedPaymentLabel(d: ReturnType<typeof useTranslation>["t"]["revenue"], method: string): string {
    return method in d.paymentMethodLabels
        ? d.paymentMethodLabels[method as keyof typeof d.paymentMethodLabels]
        : method;
}
