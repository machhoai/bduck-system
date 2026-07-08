"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import {
    AlertTriangle,
    Banknote,
    BarChart3,
    Globe2,
    ReceiptText,
    ShoppingCart,
    X,
    type LucideIcon,
} from "lucide-react";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
    chartAxisColor,
    chartGridColor,
    chartTooltipOptions,
    responsiveChartOptions,
} from "@/components/charts/chartjs";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
    getDefaultRevenueComparison,
    getDefaultRevenueFilter,
    getRevenueComparisonLabel,
    useRevenueDashboard,
    type PaymentMethodMetric,
    type RevenueDashboardData,
    type RevenueDashboardFilter,
    type RevenueMetric,
} from "@/hooks/useRevenueDashboard";
import {
    useOnlineSalesReport,
    type OnlineSalesReport,
} from "@/hooks/useOnlineSalesReport";
import { useTranslation } from "@/lib/i18n";
import RevenueDateFilter from "./RevenueDateFilter";
import {
    chartColors,
    donutColors,
    formatAxisValue,
    formatCurrency,
    formatNumber,
    getPaymentTotal,
    prepareComparableRevenuePoints,
    type ComparableRevenueChartPoint,
} from "./revenueDashboardUtils";

type StatKey =
    | "totalRevenue"
    | "totalOrders"
    | "averageOrderValue"
    | "onlineRevenue";

type RevenueDetail =
    | { type: "stat"; key: StatKey; title: string }
    | { type: "timeline"; point: ComparableRevenueChartPoint }
    | {
        type: "payment";
        method: PaymentMethodMetric;
        label: string;
        total: number;
    }
    | { type: "product"; product: DashboardTopProduct }
    | { type: "topProducts"; products: DashboardTopProduct[] };

interface DashboardTopProduct {
    id: string;
    rank: number;
    name: string;
    groupName: string;
    quantity: number;
    revenue: number;
    groupQuantity: number;
    groupRevenue: number;
}

export default function DashboardRevenueOverview() {
    const { t } = useTranslation();
    const d = t.revenue;
    const [filter, setFilter] = useState<RevenueDashboardFilter>(() =>
        getDefaultRevenueFilter(),
    );
    const comparison = useMemo(
        () => getDefaultRevenueComparison(filter),
        [filter],
    );
    const { data, loading, syncing, error } = useRevenueDashboard(filter);
    const {
        data: onlineData,
        loading: onlineLoading,
        error: onlineError,
    } = useOnlineSalesReport(filter);
    const [detail, setDetail] = useState<RevenueDetail | null>(null);
    const topProducts = useMemo(
        () => getDashboardTopProducts(data?.topProductGroups ?? []),
        [data?.topProductGroups],
    );

    return (
        <section className="flex flex-col gap-3">
            {error && (
                <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {loading && <DashboardRevenueSkeleton />}

            {!loading && data && (
                <>
                    <HeroStatButton
                        key="totalRevenue"
                        stat={{
                            label: d.stats.totalRevenue,
                            value: formatCurrency(data.stats.totalRevenue.value),
                            hint: d.stats.revenueHint,
                            icon: Banknote,
                            hero: true,
                        }}
                        onClick={() => setDetail({ type: "stat", key: "totalRevenue", title: d.stats.totalRevenue })}
                    />

                    <RevenueDateFilter
                        filter={filter}
                        comparison={comparison}
                        comparisonLabel=""
                        onChange={setFilter}
                        onComparisonChange={() => undefined}
                        generatedAt={data?.generatedAt}
                        syncing={syncing}
                        showComparison={false}
                    />

                    <DashboardRevenueStats
                        data={data}
                        onlineData={onlineData}
                        onlineLoading={onlineLoading}
                        onlineError={onlineError}
                        onSelect={(key, title) =>
                            setDetail({ type: "stat", key, title })
                        }
                    />

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <RevenueTimelinePanel
                            data={data}
                            onPointSelect={(point) =>
                                setDetail({ type: "timeline", point })
                            }
                        />
                        <PaymentMethodsPanel
                            methods={data.charts.paymentMethods}
                            onSelect={(method, label, total) =>
                                setDetail({
                                    type: "payment",
                                    method,
                                    label,
                                    total,
                                })
                            }
                        />
                    </div>

                    <TopProductsTable
                        products={topProducts}
                        onOpenAll={() =>
                            setDetail({
                                type: "topProducts",
                                products: topProducts,
                            })
                        }
                        onProductSelect={(product) =>
                            setDetail({ type: "product", product })
                        }
                    />
                </>
            )}

            {detail && data && (
                <ResponsiveRevenueDetail
                    detail={detail}
                    data={data}
                    onlineData={onlineData}
                    onlineLoading={onlineLoading}
                    onlineError={onlineError}
                    onClose={() => setDetail(null)}
                />
            )}
        </section>
    );
}

function DashboardRevenueStats({
    data,
    onlineData,
    onlineLoading,
    onlineError,
    onSelect,
}: {
    data: RevenueDashboardData;
    onlineData: OnlineSalesReport | null;
    onlineLoading: boolean;
    onlineError: string | null;
    onSelect: (key: StatKey, title: string) => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const overview = d.dashboardOverview;
    const stats: Array<{
        key: StatKey;
        label: string;
        value: string;
        hint: string;
        icon: LucideIcon;
        hero?: boolean;
        disabled?: boolean;
    }> = [
            {
                key: "totalOrders",
                label: d.stats.totalOrders,
                value: formatNumber(data.stats.totalOrders.value),
                hint: d.stats.ordersHint,
                icon: ShoppingCart,
            },
            {
                key: "averageOrderValue",
                label: d.stats.averageOrderValue,
                value: formatCurrency(data.stats.averageOrderValue.value),
                hint: d.stats.aovHint,
                icon: ReceiptText,
            },
            {
                key: "onlineRevenue",
                label: overview.websiteRevenue,
                value: onlineLoading
                    ? "..."
                    : onlineData
                        ? formatCurrency(onlineData.summary.netRevenue)
                        : "---",
                hint: onlineError ?? d.online.subtitle,
                icon: Globe2,
                disabled: onlineLoading,
            },
        ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
                <StatButton
                    key={stat.key}
                    stat={stat}
                    onClick={() => onSelect(stat.key, stat.label)}
                />
            ))}
        </div>
    );
}

function StatButton({
    stat,
    onClick,
}: {
    stat: {
        label: string;
        value: string;
        hint: string;
        icon: LucideIcon;
        hero?: boolean;
        disabled?: boolean;
    };
    onClick: () => void;
}) {
    const Icon = stat.icon;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={stat.disabled}
            className={`group relative overflow-hidden flex min-h-[80px] flex-col justify-between rounded-2xl p-4 text-left transition-all duration-150 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${stat.hero
                ? "col-span-2 bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-hover,var(--color-brand-primary))] text-white shadow-sm hover:shadow-md"
                : "col-span-1 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)]/65 hover:border-[var(--color-brand-primary)]/30 hover:shadow-sm"
                }`}
        >
            {stat.hero ? (
                <>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/12 pointer-events-none transition-transform duration-300 group-hover:scale-110" />
                    <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/8 pointer-events-none transition-transform duration-300 group-hover:scale-105" />
                </>
            ) : (
                <>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[var(--color-brand-primary)]/5 pointer-events-none transition-transform duration-300 group-hover:scale-110" />
                    <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-[var(--color-brand-primary)]/3 pointer-events-none transition-transform duration-300 group-hover:scale-105" />
                </>
            )}

            <div className="relative z-10 flex items-start justify-between w-full">
                <span
                    className={`truncate text-[10px] font-semibold tracking-wider ${stat.hero ? "text-white/80" : "text-[var(--color-text-muted)]"}`}
                >
                    {stat.label}
                </span>
                <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${stat.hero ? "bg-white/20 text-white" : "bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]"}`}
                >
                    <Icon size={15} strokeWidth={2} />
                </span>
            </div>
            <p
                className={`relative z-10 text-3xl font-bold tracking-tight tabular-nums ${stat.hero ? "text-white" : "text-[var(--color-text-primary)]"}`}
            >
                {stat.value}
            </p>
            <p
                className={`relative z-10 mt-1 line-clamp-1 text-xxs ${stat.hero ? "text-white/65" : "text-[var(--color-text-muted)]"}`}
            >
                {stat.hint}
            </p>
        </button>
    );
}

function HeroStatButton({
    stat,
    onClick,
}: {
    stat: {
        label: string;
        value: string;
        hint: string;
        icon: LucideIcon;
        hero?: boolean;
        disabled?: boolean;
    };
    onClick: () => void;
}) {
    const Icon = stat.icon;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={stat.disabled}
            className={`group relative overflow-hidden flex min-h-[80px] flex-col justify-between rounded-2xl p-3 text-left transition-all duration-150 active:scale-[0.98] disabled:cursor-wait overflow-visible disabled:opacity-70 ${stat.hero
                ? "col-span-2 bg-[var(--color-brand-primary)]  text-white"
                : "col-span-1 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)]/65 hover:border-[var(--color-brand-primary)]/30 hover:shadow-sm"
                }`}
        >
            {stat.hero ? (
                <>
                    <div className="absolute -right-10 -top-8 w-28 h-28 rounded-full bg-white/12 pointer-events-none transition-transform duration-300 group-hover:scale-110" />
                    <div className="absolute right-8 -bottom-12 w-20 h-20 rounded-full bg-white/8 pointer-events-none transition-transform duration-300 group-hover:scale-105" />
                </>
            ) : (
                <>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[var(--color-brand-primary)]/5 pointer-events-none transition-transform duration-300 group-hover:scale-110" />
                    <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-[var(--color-brand-primary)]/3 pointer-events-none transition-transform duration-300 group-hover:scale-105" />
                </>
            )}

            <p
                className={`relative z-10 text-5xl font-bold tracking-tight tabular-nums ${stat.hero ? "text-white" : "text-[var(--color-text-primary)]"}`}
            >
                {stat.value}
            </p>
            <p
                className={`relative z-10 mt-1 line-clamp-1 text-xxs ${stat.hero ? "text-white/65" : "text-[var(--color-text-muted)]"}`}
            >
                {stat.label}
            </p>
        </button>
    );
}


function RevenueTimelinePanel({
    data,
    onPointSelect,
}: {
    data: RevenueDashboardData;
    onPointSelect: (point: ComparableRevenueChartPoint) => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const prepared = useMemo(
        () =>
            prepareComparableRevenuePoints(
                data.charts.points,
                undefined,
                data.mode,
            ),
        [data.charts.points, data.mode],
    );
    const chartData = useMemo<ChartData<"bar" | "line", number[], string>>(
        () => ({
            labels: prepared.points.map((point) => point.label),
            datasets: [
                {
                    type: "bar",
                    label: d.charts.revenueBar,
                    data: prepared.points.map((point) => point.revenue),
                    backgroundColor: prepared.points.map((point) =>
                        point.highlighted
                            ? chartColors.amber
                            : "rgba(0,102,204,0.62)",
                    ),
                    borderRadius: 6,
                    order: 2,
                },
            ],
        }),
        [d.charts.revenueBar, prepared.points],
    );
    const options = useMemo<ChartOptions<"bar" | "line">>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: {
                        title: (items) =>
                            prepared.points[items[0]?.dataIndex]
                                ?.tooltipLabel ?? "",
                        label: (ctx: TooltipItem<"bar" | "line">) =>
                            `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}`,
                    },
                },
                legend: {
                    labels: {
                        color: chartAxisColor,
                        boxWidth: 10,
                        font: { size: 11 },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: chartAxisColor,
                        font: { size: 10 },
                        maxRotation: 0,
                    },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: chartAxisColor,
                        font: { size: 10 },
                        callback: (value) => formatAxisValue(Number(value)),
                    },
                    grid: { color: chartGridColor },
                },
            },
        }),
        [prepared.points],
    );

    return (
        <Panel
            title={d.charts.revenueTitle}
            subtitle={
                getRevenueComparisonLabel({
                    mode: data.mode,
                    date: data.range.endDate,
                    month: data.range.startDate.slice(0, 7),
                    year: data.range.startDate.slice(0, 4),
                    startDate: data.range.startDate,
                    endDate: data.range.endDate,
                }) || data.range.label
            }
        >
            <div className="h-[300px]">
                {prepared.points.length > 0 ? (
                    <ChartCanvas
                        type="bar"
                        data={chartData}
                        options={options}
                        onElementClick={(index) => {
                            const point = prepared.points[index];
                            if (point) onPointSelect(point);
                        }}
                    />
                ) : (
                    <EmptyState />
                )}
            </div>
        </Panel>
    );
}

function PaymentMethodsPanel({
    methods,
    onSelect,
}: {
    methods: PaymentMethodMetric[];
    onSelect: (
        method: PaymentMethodMetric,
        label: string,
        total: number,
    ) => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const total = getPaymentTotal(methods);
    const labels = useMemo(
        () => methods.map((method) => getPaymentMethodLabel(d, method.method)),
        [d, methods],
    );
    const chartData = useMemo<ChartData<"doughnut", number[], string>>(
        () => ({
            labels,
            datasets: [
                {
                    data: methods.map((method) => method.amount),
                    backgroundColor: methods.map(
                        (_, index) => donutColors[index % donutColors.length],
                    ),
                    borderColor: "#fff",
                    borderWidth: 3,
                    hoverOffset: 8,
                },
            ],
        }),
        [labels, methods],
    );
    const options = useMemo<ChartOptions<"doughnut">>(
        () => ({
            ...responsiveChartOptions,
            cutout: "66%",
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: {
                        label: (ctx) =>
                            `${ctx.label}: ${formatCurrency(Number(ctx.raw))}`,
                    },
                },
                legend: { display: false },
            },
        }),
        [],
    );

    return (
        <Panel
            title={d.charts.paymentTitle}
            subtitle={d.charts.paymentSubtitle}
        >
            <div className="grid h-full grid-cols-1 gap-3">
                <div className="min-h-[220px]">
                    {methods.length > 0 ? (
                        <ChartCanvas
                            type="doughnut"
                            data={chartData}
                            options={options}
                            onElementClick={(index) => {
                                const method = methods[index];
                                if (method)
                                    onSelect(
                                        method,
                                        labels[index] ?? method.method,
                                        total,
                                    );
                            }}
                        />
                    ) : (
                        <EmptyState />
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    {methods.slice(0, 5).map((method, index) => (
                        <button
                            key={method.method}
                            type="button"
                            onClick={() =>
                                onSelect(
                                    method,
                                    labels[index] ?? method.method,
                                    total,
                                )
                            }
                            className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors hover:bg-[var(--color-surface-card)]"
                        >
                            <span className="flex min-w-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                        backgroundColor:
                                            donutColors[
                                            index % donutColors.length
                                            ],
                                    }}
                                />
                                <span className="truncate">
                                    {labels[index] ?? method.method}
                                </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                                {method.percentage.toFixed(1)}%
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </Panel>
    );
}

function TopProductsTable({
    products,
    onOpenAll,
    onProductSelect,
}: {
    products: DashboardTopProduct[];
    onOpenAll: () => void;
    onProductSelect: (product: DashboardTopProduct) => void;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const overview = d.dashboardOverview;

    return (
        <section className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {d.topProducts.title}
                    </h3>
                    <p className="text-xxs text-[var(--color-text-muted)]">
                        {d.topProducts.subtitle}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onOpenAll}
                    className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white"
                >
                    {overview.detail}
                </button>
            </div>

            <div className="mt-3 overflow-x-auto">
                <table className="min-w-[680px] w-full text-left text-sm">
                    <thead>
                        <tr className=" text-xxs font-semibold tracking-wider text-[var(--color-text-muted)]">
                            <th className="w-14 px-2 py-2">#</th>
                            <th className="px-2 py-2">{overview.product}</th>
                            <th className="px-2 py-2">{overview.group}</th>
                            <th className="px-2 py-2 text-right">
                                {overview.quantity}
                            </th>
                            <th className="px-2 py-2 text-right">
                                {overview.revenue}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product) => (
                            <tr
                                key={product.id}
                                onClick={() => onProductSelect(product)}
                                className="cursor-pointer  transition-colors last:border-0 hover:bg-[var(--color-surface-card)]"
                            >
                                <td className="px-2 py-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-xxs font-semibold text-white">
                                        {product.rank}
                                    </span>
                                </td>
                                <td className="max-w-[280px] px-2 py-2">
                                    <p className="truncate font-medium text-[var(--color-text-primary)]">
                                        {product.name}
                                    </p>
                                </td>
                                <td className="max-w-[220px] px-2 py-2">
                                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                                        {product.groupName}
                                    </p>
                                </td>
                                <td className="px-2 py-2 text-right font-medium tabular-nums text-[var(--color-text-primary)]">
                                    {formatNumber(product.quantity)}
                                </td>
                                <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--color-text-primary)]">
                                    {formatCurrency(product.revenue)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {products.length === 0 && (
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-center text-sm text-[var(--color-text-muted)]">
                        {d.empty.noTopProducts}
                    </div>
                )}
            </div>
        </section>
    );
}

function ResponsiveRevenueDetail({
    detail,
    data,
    onlineData,
    onlineLoading,
    onlineError,
    onClose,
}: {
    detail: RevenueDetail;
    data: RevenueDashboardData;
    onlineData: OnlineSalesReport | null;
    onlineLoading: boolean;
    onlineError: string | null;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const title = getDetailTitle(
        detail,
        t.revenue.dashboardOverview.topProducts,
    );
    const isHeavy =
        detail.type === "topProducts" ||
        (detail.type === "stat" && detail.key === "onlineRevenue");
    const defaultSnap = isHeavy ? "full" : "half";

    return (
        <>
            <div
                className="fixed inset-0 z-50 hidden items-center justify-center bg-black/30 p-4 backdrop-blur-sm md:flex"
                onClick={onClose}
            >
                <div
                    className="flex max-h-[88vh] w-full max-w-[780px] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
                        <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                            {title}
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)]"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="overflow-y-auto p-4">
                        <RevenueDetailBody
                            detail={detail}
                            data={data}
                            onlineData={onlineData}
                            onlineLoading={onlineLoading}
                            onlineError={onlineError}
                        />
                    </div>
                </div>
            </div>

            <div className="md:hidden">
                <BottomSheet
                    isOpen
                    onClose={onClose}
                    defaultSnap={defaultSnap}
                    title={title}
                >
                    <div className="py-4">
                        <RevenueDetailBody
                            detail={detail}
                            data={data}
                            onlineData={onlineData}
                            onlineLoading={onlineLoading}
                            onlineError={onlineError}
                        />
                    </div>
                </BottomSheet>
            </div>
        </>
    );
}

function RevenueDetailBody({
    detail,
    data,
    onlineData,
    onlineLoading,
    onlineError,
}: {
    detail: RevenueDetail;
    data: RevenueDashboardData;
    onlineData: OnlineSalesReport | null;
    onlineLoading: boolean;
    onlineError: string | null;
}) {
    if (detail.type === "stat") {
        return (
            <StatDetailContent
                statKey={detail.key}
                data={data}
                onlineData={onlineData}
                onlineLoading={onlineLoading}
                onlineError={onlineError}
            />
        );
    }

    if (detail.type === "timeline") {
        return <TimelinePointDetail point={detail.point} />;
    }

    if (detail.type === "payment") {
        return (
            <PaymentDetail
                method={detail.method}
                label={detail.label}
                total={detail.total}
            />
        );
    }

    if (detail.type === "product") {
        return <ProductDetail product={detail.product} />;
    }

    return <TopProductsDetail products={detail.products} />;
}

function StatDetailContent({
    statKey,
    data,
    onlineData,
    onlineLoading,
    onlineError,
}: {
    statKey: StatKey;
    data: RevenueDashboardData;
    onlineData: OnlineSalesReport | null;
    onlineLoading: boolean;
    onlineError: string | null;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const overview = d.dashboardOverview;

    if (statKey === "onlineRevenue") {
        return (
            <OnlineRevenueDetail
                onlineData={onlineData}
                onlineLoading={onlineLoading}
                onlineError={onlineError}
            />
        );
    }

    const metric = data.stats[statKey] as RevenueMetric;

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
                <DetailBox
                    label={d.detail.current}
                    value={formatStatValue(statKey, metric.value)}
                    highlight
                />
                <DetailBox
                    label={d.detail.previous}
                    value={formatStatValue(statKey, metric.previousValue)}
                />
                <DetailBox
                    label={d.detail.change}
                    value={`${metric.changePercent > 0 ? "+" : ""}${metric.changePercent.toFixed(1)}%`}
                />
            </div>

            {statKey === "totalRevenue" && (
                <>
                    <SectionTitle title={overview.revenueStructure} />
                    <div className="grid grid-cols-2 gap-2">
                        <DetailBox
                            label={overview.joyWorld}
                            value={formatCurrency(
                                data.stats.totalRevenue.value,
                            )}
                            highlight
                        />
                        <DetailBox
                            label={overview.website}
                            value={
                                onlineData
                                    ? formatCurrency(
                                        onlineData.summary.netRevenue,
                                    )
                                    : "---"
                            }
                        />
                    </div>
                    <PaymentBreakdown methods={data.stats.paymentMethods} />
                </>
            )}

            {statKey === "totalOrders" && (
                <>
                    <SectionTitle title={overview.orderStructure} />
                    <div className="grid grid-cols-3 gap-2">
                        <DetailBox
                            label={overview.joyWorld}
                            value={formatNumber(data.stats.totalOrders.value)}
                            highlight
                        />
                        <DetailBox
                            label={overview.website}
                            value={
                                onlineData
                                    ? formatNumber(
                                        onlineData.summary.orderCount,
                                    )
                                    : "---"
                            }
                        />
                        <DetailBox
                            label={overview.websiteProducts}
                            value={
                                onlineData
                                    ? formatNumber(
                                        onlineData.summary.itemQuantity,
                                    )
                                    : "---"
                            }
                        />
                    </div>
                    <PaymentBreakdown methods={data.stats.paymentMethods} />
                </>
            )}

            {statKey === "averageOrderValue" && (
                <>
                    <SectionTitle title={overview.averageValue} />
                    <div className="grid grid-cols-3 gap-2">
                        <DetailBox
                            label={d.stats.totalRevenue}
                            value={formatCurrency(
                                data.stats.totalRevenue.value,
                            )}
                        />
                        <DetailBox
                            label={d.stats.totalOrders}
                            value={formatNumber(data.stats.totalOrders.value)}
                        />
                        <DetailBox
                            label={overview.websiteAov}
                            value={
                                onlineData
                                    ? formatCurrency(
                                        onlineData.summary.averageOrderValue,
                                    )
                                    : "---"
                            }
                            highlight
                        />
                    </div>
                </>
            )}
        </div>
    );
}

function OnlineRevenueDetail({
    onlineData,
    onlineLoading,
    onlineError,
}: {
    onlineData: OnlineSalesReport | null;
    onlineLoading: boolean;
    onlineError: string | null;
}) {
    const { t } = useTranslation();
    const d = t.revenue.online;

    if (onlineLoading) {
        return (
            <div className="h-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]" />
        );
    }

    if (onlineError || !onlineData) {
        return (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
                {onlineError ?? d.empty}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                <DetailBox
                    label={d.metrics.netRevenue}
                    value={formatCurrency(onlineData.summary.netRevenue)}
                    highlight
                />
                <DetailBox
                    label={d.metrics.orders}
                    value={formatNumber(onlineData.summary.orderCount)}
                />
                <DetailBox
                    label={d.metrics.averageOrderValue}
                    value={formatCurrency(onlineData.summary.averageOrderValue)}
                />
                <DetailBox
                    label={d.metrics.grossRevenue}
                    value={formatCurrency(onlineData.summary.grossRevenue)}
                />
                <DetailBox
                    label={d.metrics.discountAmount}
                    value={formatCurrency(onlineData.summary.discountAmount)}
                />
                <DetailBox
                    label={d.metrics.passesIssued}
                    value={formatNumber(onlineData.summary.passesIssued)}
                />
            </div>
            <OnlineProviderBreakdown providers={onlineData.paymentProviders} />
            <OnlineProductList products={onlineData.productSales.slice(0, 6)} />
        </div>
    );
}

function TimelinePointDetail({
    point,
}: {
    point: ComparableRevenueChartPoint;
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1.5 text-center text-xs font-semibold text-[var(--color-text-primary)]">
                {point.tooltipLabel ?? point.label}
            </div>
            <div className="grid grid-cols-3 gap-2">
                <DetailBox
                    label={d.stats.totalRevenue}
                    value={formatCurrency(point.revenue)}
                    highlight
                />
                <DetailBox
                    label={d.stats.totalOrders}
                    value={formatNumber(point.orderCount)}
                />
                <DetailBox
                    label={d.stats.memberCardSales}
                    value={formatCurrency(point.memberCardAmount)}
                />
            </div>
        </div>
    );
}

function PaymentDetail({
    method,
    label,
    total,
}: {
    method: PaymentMethodMetric;
    label: string;
    total: number;
}) {
    const { t } = useTranslation();
    const overview = t.revenue.dashboardOverview;
    const percentage =
        total > 0 ? (method.amount / total) * 100 : method.percentage;
    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
                <DetailBox
                    label={overview.revenue}
                    value={formatCurrency(method.amount)}
                    highlight
                />
                <DetailBox
                    label={t.revenue.stats.totalOrders}
                    value={formatNumber(method.orderCount)}
                />
                <DetailBox
                    label={overview.share}
                    value={`${percentage.toFixed(1)}%`}
                />
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[var(--color-text-primary)]">
                        {label}
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                        {formatCurrency(method.amount)}
                    </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                    <div
                        className="h-full rounded-full bg-[var(--color-brand-primary)]"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function ProductDetail({ product }: { product: DashboardTopProduct }) {
    const { t } = useTranslation();
    const overview = t.revenue.dashboardOverview;
    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
                <DetailBox
                    label={overview.revenue}
                    value={formatCurrency(product.revenue)}
                    highlight
                />
                <DetailBox
                    label={overview.quantity}
                    value={formatNumber(product.quantity)}
                />
                <DetailBox label={overview.rank} value={`#${product.rank}`} />
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                <p className="text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)]">
                    {overview.productGroup}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
                    {product.groupName}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <DetailBox
                        label={overview.groupRevenue}
                        value={formatCurrency(product.groupRevenue)}
                    />
                    <DetailBox
                        label={overview.groupQuantity}
                        value={formatNumber(product.groupQuantity)}
                    />
                </div>
            </div>
        </div>
    );
}

function TopProductsDetail({ products }: { products: DashboardTopProduct[] }) {
    return (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
            {products.map((product) => (
                <div
                    key={product.id}
                    className="p-3 bg-[var(--color-surface-card)]"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                #{product.rank} {product.name}
                            </p>
                            <p className="truncate text-[10px] text-[var(--color-text-muted)] font-medium">
                                {product.groupName}
                            </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                            {formatCurrency(product.revenue)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PaymentBreakdown({ methods }: { methods: PaymentMethodMetric[] }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const overview = d.dashboardOverview;
    const total = getPaymentTotal(methods);

    return (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
            {methods.map((method, index) => {
                const percentage =
                    total > 0
                        ? (method.amount / total) * 100
                        : method.percentage;
                return (
                    <div
                        key={method.method}
                        className="p-3 bg-[var(--color-surface-card)]"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                        backgroundColor:
                                            donutColors[
                                            index % donutColors.length
                                            ],
                                    }}
                                />
                                <span className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                    {getPaymentMethodLabel(d, method.method)}
                                </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                                {formatCurrency(method.amount)}
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${Math.min(percentage, 100)}%`,
                                    backgroundColor:
                                        donutColors[index % donutColors.length],
                                }}
                            />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-medium">
                            <span>
                                {formatNumber(method.orderCount)}{" "}
                                {overview.ordersUnit}
                            </span>
                            <span className="font-semibold text-[var(--color-text-primary)]">
                                {percentage.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OnlineProviderBreakdown({
    providers,
}: {
    providers: OnlineSalesReport["paymentProviders"];
}) {
    const { t } = useTranslation();
    const d = t.revenue.online;
    const total = providers.reduce(
        (sum, provider) => sum + provider.netRevenue,
        0,
    );
    if (providers.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <SectionTitle title={d.payments.title} />
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
                {providers.map((provider, index) => {
                    const percentage =
                        total > 0 ? (provider.netRevenue / total) * 100 : 0;
                    return (
                        <div
                            key={provider.provider}
                            className="p-3 bg-[var(--color-surface-card)]"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                    {provider.provider}
                                </span>
                                <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                                    {formatCurrency(provider.netRevenue)}
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${Math.min(percentage, 100)}%`,
                                        backgroundColor:
                                            donutColors[index % donutColors.length],
                                    }}
                                />
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-medium">
                                <span>
                                    {formatNumber(provider.orderCount)}{" "}
                                    {d.payments.orders}
                                </span>
                                <span className="font-semibold text-[var(--color-text-primary)]">
                                    {percentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function OnlineProductList({
    products,
}: {
    products: OnlineSalesReport["productSales"];
}) {
    const { t } = useTranslation();
    const d = t.revenue.online;
    if (products.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <SectionTitle title={d.products.title} />
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
                {products.map((product, index) => (
                    <div
                        key={product.productId || product.productName}
                        className="p-3 bg-[var(--color-surface-card)]"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                    #{index + 1} {product.productName}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                                    {formatNumber(product.quantitySold)}{" "}
                                    {d.products.units} /{" "}
                                    {formatNumber(product.orderCount)}{" "}
                                    {d.products.orders}
                                </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                                {formatCurrency(product.netRevenue)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <section className="flex h-full flex-col gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
            <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {title}
                </h3>
                <p className="text-xxs text-[var(--color-text-muted)]">
                    {subtitle}
                </p>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
        </section>
    );
}

function DetailBox({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)]/70 bg-[var(--color-surface-card)] p-2">
            <p className="truncate text-[9px] font-semibold tracking-wider text-[var(--color-text-muted)]">
                {label}
            </p>
            <p
                className={`mt-1.5 truncate tabular-nums tracking-tight ${highlight ? "text-xs font-bold text-[var(--color-brand-primary)]" : "text-xs font-semibold text-[var(--color-text-primary)]"}`}
            >
                {value}
            </p>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
    return (
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
        </h4>
    );
}

function EmptyState() {
    const { t } = useTranslation();
    return (
        <div className="flex h-full min-h-[180px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)]">
            {t.common.noData}
        </div>
    );
}

function DashboardRevenueSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className={`h-[108px] animate-pulse rounded-[var(--radius-lg)] ${index === 0 ? "bg-[var(--color-brand-primary)]/70" : "bg-[var(--color-surface-elevated)]"}`}
                    />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="h-[360px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)]" />
                <div className="h-[360px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)]" />
            </div>
        </div>
    );
}

function getDashboardTopProducts(
    groups: RevenueDashboardData["topProductGroups"],
): DashboardTopProduct[] {
    const rows = groups.flatMap((group) => {
        if (group.items.length === 0) {
            return [
                {
                    id: group.groupName,
                    rank: 0,
                    name: group.groupName,
                    groupName: group.groupName,
                    quantity: group.quantity,
                    revenue: group.revenue,
                    groupQuantity: group.quantity,
                    groupRevenue: group.revenue,
                },
            ];
        }

        return group.items.map((item) => ({
            id: `${group.groupName}-${item.name}`,
            rank: 0,
            name: item.name,
            groupName: group.groupName,
            quantity: item.quantity,
            revenue: item.revenue,
            groupQuantity: group.quantity,
            groupRevenue: group.revenue,
        }));
    });

    return rows
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((row, index) => ({ ...row, rank: index + 1 }));
}

function getPaymentMethodLabel(
    d: ReturnType<typeof useTranslation>["t"]["revenue"],
    method: string,
): string {
    return method in d.paymentMethodLabels
        ? d.paymentMethodLabels[method as keyof typeof d.paymentMethodLabels]
        : method;
}

function getDetailTitle(
    detail: RevenueDetail,
    topProductsLabel: string,
): string {
    if (detail.type === "stat") return detail.title;
    if (detail.type === "timeline")
        return detail.point.tooltipLabel ?? detail.point.label;
    if (detail.type === "payment") return detail.label;
    if (detail.type === "product") return detail.product.name;
    return topProductsLabel;
}

function formatStatValue(key: StatKey, value: number): string {
    if (key === "totalOrders") return formatNumber(value);
    return formatCurrency(value);
}
