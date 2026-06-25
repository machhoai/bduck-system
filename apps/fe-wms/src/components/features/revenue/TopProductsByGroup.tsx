"use client";

import type { TopProductGroup } from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency, formatNumber } from "./revenueDashboardUtils";

interface TopProductsByGroupProps {
    groups: TopProductGroup[];
}

export default function TopProductsByGroup({ groups }: TopProductsByGroupProps) {
    const { t } = useTranslation();
    const d = t.revenue;
    const topRevenue = Math.max(...groups.map((g) => g.revenue), 1);

    return (
        <section className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
            <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{d.topProducts.title}</h2>
                <p className="text-xxs text-[var(--color-text-muted)]">{d.topProducts.subtitle}</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {groups.map((group, index) => {
                    const pct = Math.min((group.revenue / topRevenue) * 100, 100);

                    return (
                        <div key={group.groupName} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-xxs font-semibold text-white">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{group.groupName}</h3>
                                        <p className="text-xxs text-[var(--color-text-muted)]">
                                            {formatNumber(group.quantity)} {d.topProducts.units}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                                    {formatCurrency(group.revenue)}
                                </span>
                            </div>

                            {/* Progress */}
                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                                <div
                                    className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all duration-500"
                                    style={{ width: `${pct}%`, opacity: index < 3 ? 1 : 0.5 }}
                                />
                            </div>

                            {/* Items */}
                            <div className="mt-2.5 flex flex-col gap-1">
                                {group.items.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between gap-3 px-2 py-1">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{item.name}</p>
                                            <p className="text-xxs text-[var(--color-text-muted)]">
                                                {formatNumber(item.quantity)} {d.topProducts.units}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                                            {formatCurrency(item.revenue)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {groups.length === 0 && (
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-center text-sm text-[var(--color-text-muted)] xl:col-span-2">
                        {d.empty.noTopProducts}
                    </div>
                )}
            </div>
        </section>
    );
}
