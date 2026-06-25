"use client";

import type { ReactNode } from "react";
import type { DeviceConsumptionItem } from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import { formatNumber } from "./revenueDashboardUtils";

interface DeviceConsumptionTableProps {
    rows: DeviceConsumptionItem[];
}

export default function DeviceConsumptionTable({ rows }: DeviceConsumptionTableProps) {
    const { t } = useTranslation();
    const d = t.revenue.deviceConsumption;

    const showTotal = rows.length > 1;
    const totalElectronic = rows.reduce((sum, row) => sum + (row.electronicCoinConsum || 0), 0);
    const totalPhysical = rows.reduce((sum, row) => sum + (row.physicalCoinConsum || 0), 0);
    const totalConsum = rows.reduce((sum, row) => sum + (row.totalConsum || 0), 0);
    const totalGive = rows.reduce((sum, row) => sum + (row.coinGiveQuantity || 0), 0);

    return (
        <section className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-3 font-sans shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{d.title}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{d.subtitle}</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {rows.map((row) => (
                    <div key={row.date} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3 shadow-sm ring-1 ring-black/[0.04]">
                        <div className="mb-2 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{row.date}</h3>
                            <span className="tabular-nums text-sm font-bold text-[var(--color-brand-primary)]">
                                {formatNumber(row.totalConsum)}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.electronic}</span>
                                <span className="tabular-nums text-sm font-medium text-[var(--color-text-primary)]">{formatNumber(row.electronicCoinConsum)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.physical}</span>
                                <span className="tabular-nums text-sm font-medium text-[var(--color-text-primary)]">{formatNumber(row.physicalCoinConsum)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.give}</span>
                                <span className="tabular-nums text-sm font-medium text-[var(--color-text-primary)]">{row.coinGiveQuantity != null ? formatNumber(row.coinGiveQuantity) : "-"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.rate}</span>
                                <span className="tabular-nums text-sm font-medium text-[var(--color-text-primary)]">{row.coinConsumRate || "-"}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {showTotal && (
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)]/5 p-3 ring-1 ring-[var(--color-brand-primary)]/20 xl:col-span-2">
                        <div className="mb-2 flex items-center justify-between border-b border-[var(--color-brand-primary)]/10 pb-2">
                            <h3 className="text-sm font-bold text-[var(--color-brand-primary)]">Tổng cộng</h3>
                            <span className="tabular-nums text-base font-bold text-[var(--color-brand-primary)]">
                                {formatNumber(totalConsum)}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
                            <div className="flex items-center justify-between md:flex-col md:items-start md:gap-0.5">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.electronic}</span>
                                <span className="tabular-nums text-sm font-bold text-[var(--color-text-primary)]">{formatNumber(totalElectronic)}</span>
                            </div>
                            <div className="flex items-center justify-between md:flex-col md:items-start md:gap-0.5">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.physical}</span>
                                <span className="tabular-nums text-sm font-bold text-[var(--color-text-primary)]">{formatNumber(totalPhysical)}</span>
                            </div>
                            <div className="flex items-center justify-between md:flex-col md:items-start md:gap-0.5">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.give}</span>
                                <span className="tabular-nums text-sm font-bold text-[var(--color-text-primary)]">{formatNumber(totalGive)}</span>
                            </div>
                            <div className="flex items-center justify-between md:flex-col md:items-start md:gap-0.5">
                                <span className="text-xs text-[var(--color-text-muted)]">{d.columns.rate}</span>
                                <span className="tabular-nums text-sm font-bold text-[var(--color-text-primary)]">-</span>
                            </div>
                        </div>
                    </div>
                )}

                {rows.length === 0 && (
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-center text-sm text-[var(--color-text-muted)] xl:col-span-2">
                        {d.empty}
                    </div>
                )}
            </div>
        </section>
    );
}
