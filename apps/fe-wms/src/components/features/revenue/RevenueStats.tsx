"use client";

import { useEffect, useState } from "react";
import {
    Banknote,
    CreditCard,
    ReceiptText,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
    X,
} from "lucide-react";
import type { PaymentMethodMetric, RevenueDashboardData, RevenueMetric } from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency, formatNumber, getMetricTone, getPaymentTotal, donutColors } from "./revenueDashboardUtils";

type StatKey = "totalRevenue" | "totalOrders" | "averageOrderValue" | "memberCardSales";

interface RevenueStatsProps {
    data: RevenueDashboardData;
}

const statIcons = {
    totalRevenue: Banknote,
    totalOrders: ShoppingCart,
    averageOrderValue: ReceiptText,
    memberCardSales: CreditCard,
};

export default function RevenueStats({ data }: RevenueStatsProps) {
    const { t } = useTranslation();
    const d = t.revenue;
    const [selected, setSelected] = useState<StatKey | null>(null);

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
                        onClick={() => setSelected(card.key)}
                    />
                ))}
            </div>

            {selected && (
                <StatDetailModal selected={selected} data={data} onClose={() => setSelected(null)} />
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
    onClick,
}: {
    card: { key: StatKey; label: string; value: number; formatValue: (v: number) => string; metric?: RevenueMetric; hint: string };
    icon: typeof Banknote;
    isHero: boolean;
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
                <span className={`truncate text-xs font-semibold tracking-wide ${isHero ? "opacity-80" : "text-[var(--color-text-muted)]"}`}>
                    {card.label}
                </span>
            </div>

            {/* Hero number */}
            <p className={`truncate tabular-nums ${isHero
                ? "text-2xl font-extrabold"
                : "text-lg font-bold text-[var(--color-text-primary)]"
                }`}>
                <AnimatedNumber value={card.value} formatValue={card.formatValue} />
            </p>

            {/* Hint + trend */}
            <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-xxs ${isHero ? "opacity-60" : "text-[var(--color-text-muted)]"}`}>
                    {card.hint}
                </span>
                {card.metric && (
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

function StatDetailModal({ selected, data, onClose }: { selected: StatKey; data: RevenueDashboardData; onClose: () => void }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const paymentTotal = getPaymentTotal(data.stats.paymentMethods);
    const title = d.stats[selected];
    const comparisonText =
        data.comparisonLabel in d.comparison
            ? d.comparison[data.comparisonLabel as keyof typeof d.comparison]
            : data.comparisonLabel;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
            <div
                className="flex w-full flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4 shadow-2xl sm:w-[560px]"
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

                <MetricDetail metric={data.stats[selected]} selected={selected} />

                {selected === "totalRevenue" && (
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

function MetricDetail({ metric, selected }: { metric: RevenueMetric; selected: StatKey }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const tone = getMetricTone(metric);
    const color = tone === "up" ? "var(--color-success-text)" : tone === "down" ? "var(--color-error-text)" : "var(--color-neutral-500)";
    const fmtVal = selected === "totalOrders" ? formatNumber : formatCurrency;

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailBox label={d.detail.current} value={fmtVal(metric.value)} bold />
            <DetailBox label={d.detail.previous} value={fmtVal(metric.previousValue)} />
            <DetailBox
                label={d.detail.change}
                value={`${metric.changePercent > 0 ? "+" : ""}${metric.changePercent.toFixed(1)}%`}
                color={color}
            />
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
