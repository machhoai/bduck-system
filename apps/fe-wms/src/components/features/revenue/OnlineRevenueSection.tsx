"use client";

import { useMemo, type ReactNode } from "react";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { AlertTriangle, Banknote, CreditCard, Globe2, PackageCheck, ReceiptText, Ticket } from "lucide-react";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
    chartAxisColor,
    chartGridColor,
    chartTooltipOptions,
    responsiveChartOptions,
} from "@/components/charts/chartjs";
import type { RevenueDashboardFilter } from "@/hooks/useRevenueDashboard";
import { useOnlineSalesReport, type OnlinePaymentProvider, type OnlineProductSale } from "@/hooks/useOnlineSalesReport";
import { useTranslation } from "@/lib/i18n";
import { chartColors, donutColors, formatAxisValue, formatCurrency, formatNumber } from "./revenueDashboardUtils";

interface OnlineRevenueSectionProps {
    filter: RevenueDashboardFilter;
}

export default function OnlineRevenueSection({ filter }: OnlineRevenueSectionProps) {
    const { t } = useTranslation();
    const d = t.revenue.online;
    const { data, loading, error } = useOnlineSalesReport(filter);

    return (
        <section className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4 shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-white">
                        <Globe2 size={18} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{d.title}</h2>
                        <p className="text-xs text-[var(--color-text-muted)]">{d.subtitle}</p>
                    </div>
                </div>
                {data?.generatedAt && (
                    <span className="shrink-0 text-xxs font-medium text-[var(--color-text-muted)]">
                        {d.generatedAt}: {new Date(data.generatedAt).toLocaleString("vi-VN")}
                    </span>
                )}
            </div>

            {loading && <OnlineRevenueSkeleton />}

            {!loading && error && (
                <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && data && (
                <div className="mt-4 flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <OnlineMetric icon={<Banknote size={16} />} label={d.metrics.netRevenue} value={formatCurrency(data.summary.netRevenue)} highlight />
                        <OnlineMetric icon={<ReceiptText size={16} />} label={d.metrics.orders} value={formatNumber(data.summary.orderCount)} />
                        <OnlineMetric icon={<PackageCheck size={16} />} label={d.metrics.itemQuantity} value={formatNumber(data.summary.itemQuantity)} />
                        <OnlineMetric icon={<Ticket size={16} />} label={d.metrics.passesIssued} value={formatNumber(data.summary.passesIssued)} />
                        <OnlineMetric icon={<CreditCard size={16} />} label={d.metrics.averageOrderValue} value={formatCurrency(data.summary.averageOrderValue)} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                        <div className="xl:col-span-3">
                            <OnlineDailyChart data={data.dailySales} />
                        </div>
                        <OnlinePaymentProviders providers={data.paymentProviders} />
                    </div>

                    <OnlineProductSales products={data.productSales} />
                </div>
            )}
        </section>
    );
}

function OnlineMetric({ icon, label, value, highlight }: { icon: ReactNode; label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`rounded-[var(--radius-sm)] p-3 ${highlight ? "bg-[var(--color-brand-primary)] text-white" : "bg-[var(--color-surface-card)]"}`}>
            <div className="flex items-center gap-2">
                <span className={highlight ? "opacity-75" : "text-[var(--color-text-muted)]"}>{icon}</span>
                <span className={`truncate text-xs font-medium ${highlight ? "opacity-80" : "text-[var(--color-text-muted)]"}`}>{label}</span>
            </div>
            <p className={`mt-2 truncate text-lg font-bold tabular-nums ${highlight ? "" : "text-[var(--color-text-primary)]"}`}>{value}</p>
        </div>
    );
}

function OnlineDailyChart({ data }: { data: { date: string; netRevenue: number; orderCount: number }[] }) {
    const { t } = useTranslation();
    const d = t.revenue.online;
    const chartData = useMemo<ChartData<"bar", number[], string>>(
        () => ({
            labels: data.map((row) => row.date.slice(5)),
            datasets: [{
                label: d.charts.dailyNetRevenue,
                data: data.map((row) => row.netRevenue),
                backgroundColor: "rgba(0,102,204,0.62)",
                borderRadius: 6,
            }],
        }),
        [d.charts.dailyNetRevenue, data],
    );
    const options = useMemo<ChartOptions<"bar">>(
        () => ({
            ...responsiveChartOptions,
            plugins: {
                tooltip: {
                    ...chartTooltipOptions,
                    callbacks: {
                        label: (ctx: TooltipItem<"bar">) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}`,
                    },
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
        [],
    );

    return (
        <Panel title={d.charts.dailyTitle} subtitle={d.charts.dailySubtitle}>
            <div className="h-[260px]">
                {data.length > 0 ? <ChartCanvas type="bar" data={chartData} options={options} /> : <EmptyOnlineData />}
            </div>
        </Panel>
    );
}

function OnlinePaymentProviders({ providers }: { providers: OnlinePaymentProvider[] }) {
    const { t } = useTranslation();
    const d = t.revenue.online;
    const total = providers.reduce((sum, row) => sum + row.netRevenue, 0);

    return (
        <Panel title={d.payments.title} subtitle={d.payments.subtitle}>
            <div className="flex flex-col gap-2">
                {providers.map((provider, index) => {
                    const percentage = total > 0 ? (provider.netRevenue / total) * 100 : 0;
                    const color = donutColors[index % donutColors.length];
                    return (
                        <div key={provider.provider} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{provider.provider}</span>
                                </span>
                                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                                    {formatCurrency(provider.netRevenue)}
                                </span>
                            </div>
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }} />
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-xxs text-[var(--color-text-muted)]">
                                <span>{formatNumber(provider.orderCount)} {d.payments.orders}</span>
                                <span className="font-semibold">{percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    );
                })}
                {providers.length === 0 && <EmptyOnlineData />}
            </div>
        </Panel>
    );
}

function OnlineProductSales({ products }: { products: OnlineProductSale[] }) {
    const { t } = useTranslation();
    const d = t.revenue.online;
    const visibleProducts = products.slice(0, 6);
    const topRevenue = Math.max(...visibleProducts.map((product) => product.netRevenue), 1);

    return (
        <Panel title={d.products.title} subtitle={d.products.subtitle}>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {visibleProducts.map((product, index) => {
                    const percentage = Math.min((product.netRevenue / topRevenue) * 100, 100);
                    return (
                        <div key={product.productId || product.productName} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-xxs font-semibold text-white">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{product.productName}</h3>
                                        <p className="text-xxs text-[var(--color-text-muted)]">
                                            {formatNumber(product.quantitySold)} {d.products.units} / {formatNumber(product.orderCount)} {d.products.orders}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                                    {formatCurrency(product.netRevenue)}
                                </span>
                            </div>
                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%`, backgroundColor: index === 0 ? chartColors.green : chartColors.blue, opacity: index < 3 ? 1 : 0.55 }}
                                />
                            </div>
                        </div>
                    );
                })}
                {visibleProducts.length === 0 && <EmptyOnlineData />}
            </div>
        </Panel>
    );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <div className="flex h-full flex-col gap-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] p-3 ring-1 ring-black/[0.04]">
            <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <p className="text-xxs text-[var(--color-text-muted)]">{subtitle}</p>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
        </div>
    );
}

function EmptyOnlineData() {
    const { t } = useTranslation();
    return (
        <div className="flex min-h-[120px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)]">
            {t.revenue.online.empty}
        </div>
    );
}

function OnlineRevenueSkeleton() {
    return (
        <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-[86px] animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <div className="h-[310px] animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] xl:col-span-3" />
                <div className="h-[310px] animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]" />
            </div>
        </div>
    );
}
