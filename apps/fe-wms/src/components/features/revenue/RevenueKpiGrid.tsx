"use client";

import type { RevenueDashboardData, RevenueMetric } from "@bduck/shared-types";
import {
    ArrowDownRight,
    ArrowUpRight,
    Calculator,
    ReceiptText,
    ShieldCheck,
    Sigma,
    Sparkles,
    type LucideIcon,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { formatCurrency, formatNumber } from "./revenueDashboardUtils";

export default function RevenueKpiGrid({
    data,
}: {
    data: RevenueDashboardData;
}) {
    const { t } = useTranslation();
    const copy = t.revenue.stats;
    const totalRevenue = data.stats.totalRevenue.value;
    const supportingMetrics: Array<{
        label: string;
        metric: RevenueMetric;
        icon: LucideIcon;
        format: "currency" | "number";
        tone: string;
    }> = [
            {
                label: copy.amountBeforeTax,
                metric: data.stats.amountBeforeTax,
                icon: Sigma,
                format: "currency",
                tone: "bg-blue-50 text-blue-700",
            },
            {
                label: copy.totalTax,
                metric: data.stats.totalTax,
                icon: ShieldCheck,
                format: "currency",
                tone: "bg-violet-50 text-violet-700",
            },
            {
                label: copy.totalOrders,
                metric: data.stats.totalOrders,
                icon: ReceiptText,
                format: "number",
                tone: "bg-emerald-50 text-emerald-700",
            },
            {
                label: copy.averageOrderValue,
                metric: data.stats.averageOrderValue,
                icon: Calculator,
                format: "currency",
                tone: "bg-amber-50 text-amber-700",
            },
        ];

    return (
        <section
            aria-label={copy.totalRevenue}
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
            <article className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-brand-primary)] p-4 text-white shadow-[0_14px_34px_rgba(0,102,204,0.18)] col-span-2 xl:row-span-2">
                <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/5" />
                <div className="relative flex h-full min-h-40 flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold tracking-wider text-white/70">
                                {copy.totalRevenue}
                            </p>
                            <p className="mt-1 break-words text-3xl font-bold tabular-nums">
                                {formatCurrency(totalRevenue)}
                            </p>
                            <ChangeLine metric={data.stats.totalRevenue} inverted />
                        </div>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white/15 ring-1 ring-white/15">
                            <Sparkles size={20} aria-hidden="true" />
                        </span>
                    </div>

                    <div
                        className={`grid gap-2 ${data.stats.otherRevenue.value > 0 ? "md:grid-cols-3 grid-cols-2 " : "grid-cols-2"
                            }`}
                    >
                        <PaymentSummary
                            label={copy.cashRevenue}
                            amount={data.stats.cashRevenue.value}
                            total={totalRevenue}
                        />
                        <PaymentSummary
                            label={copy.transferRevenue}
                            amount={data.stats.transferRevenue.value}
                            total={totalRevenue}
                        />
                        {data.stats.otherRevenue.value > 0 && (
                            <PaymentSummary
                                label={copy.otherRevenue}
                                amount={data.stats.otherRevenue.value}
                                total={totalRevenue}
                            />
                        )}
                    </div>
                </div>
            </article>

            {supportingMetrics.map((item) => (
                <article
                    key={item.label}
                    className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                >
                    <div className="flex items-start justify-between gap-2">
                        <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${item.tone}`}
                        >
                            <item.icon size={15} aria-hidden="true" />
                        </span>
                        <ChangeLine metric={item.metric} compact />
                    </div>
                    <div className="mt-3">
                        <p className="truncate text-base font-bold tabular-nums text-[var(--color-text-primary)] sm:text-lg">
                            {item.format === "number"
                                ? formatNumber(item.metric.value)
                                : formatCurrency(item.metric.value)}
                        </p>
                        <p
                            className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]"
                            title={item.label}
                        >
                            {item.label}
                        </p>
                    </div>
                </article>
            ))}
        </section>
    );
}

function PaymentSummary({
    label,
    amount,
    total,
}: {
    label: string;
    amount: number;
    total: number;
}) {
    const percentage = total > 0 ? (amount / total) * 100 : 0;
    return (
        <div className="min-w-0 rounded-[var(--radius-md)] bg-white/10 px-2.5 py-2 ring-1 ring-white/10">
            <p className="truncate text-xs text-white/70">{label}</p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums">
                {formatCurrency(amount)}
            </p>
            <p className="mt-0.5 text-xxs tabular-nums text-white/70">
                {percentage.toFixed(1)}%
            </p>
        </div>
    );
}

function ChangeLine({
    metric,
    compact = false,
    inverted = false,
}: {
    metric: RevenueMetric;
    compact?: boolean;
    inverted?: boolean;
}) {
    if (metric.previousValue === 0) {
        return compact ? (
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
                —
            </span>
        ) : (
            <span
                className={`mt-2 block text-xs ${inverted ? "text-white/60" : "text-[var(--color-text-muted)]"}`}
            >
                —
            </span>
        );
    }
    const positive = metric.changePercent >= 0;
    const Icon = positive ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={`${compact ? "inline-flex" : "mt-2 inline-flex"} items-center gap-1 rounded-full px-2 py-1 text-xxs font-medium tabular-nums ${inverted
                ? "bg-white/15 text-white"
                : positive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
        >
            <Icon size={12} aria-hidden="true" />
            {Math.abs(metric.changePercent).toFixed(1)}%
        </span>
    );
}
