"use client";

import { Clock3 } from "lucide-react";

import type {
    RevenueCompareMode,
    RevenueComparisonSelection,
    RevenueDashboardFilter,
    RevenueDateMode,
} from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";

import {
    RevenueActiveComparisonChips,
    RevenueComparisonDateFields,
    RevenueFilterDateFields,
} from "./RevenueDateFilterFields";

interface RevenueDateFilterProps {
    filter: RevenueDashboardFilter;
    comparison: RevenueComparisonSelection;
    comparisonLabel: string;
    onChange: (filter: RevenueDashboardFilter) => void;
    onComparisonChange: (comparison: RevenueComparisonSelection) => void;
    generatedAt?: string;
    syncing?: boolean;
    showComparison?: boolean;
}

const modeKeys: RevenueDateMode[] = ["date", "month", "year", "custom"];

export default function DashboardRevenueDateFilter({
    filter,
    comparison,
    comparisonLabel,
    onChange,
    onComparisonChange,
    generatedAt,
    syncing,
    showComparison = true,
}: RevenueDateFilterProps) {
    const { t } = useTranslation();
    const d = t.revenue;

    const update = (patch: Partial<RevenueDashboardFilter>) => {
        onChange({ ...filter, ...patch });
    };

    const updateComparison = (patch: Partial<RevenueComparisonSelection>) => {
        onComparisonChange({ ...comparison, ...patch });
    };
    const comparisonEnabled = comparison.mode !== "none";
    const comparisonModeKeys = getComparisonModes(filter.mode);
    const activeComparisonMode = comparisonModeKeys.includes(comparison.mode)
        ? comparison.mode
        : "previous";
    const generatedAtLabel = syncing
        ? d.syncing
        : generatedAt
            ? new Date(generatedAt).toLocaleString("vi-VN")
            : "---";

    const addComparisonValue = (nextValue?: string) => {
        if (activeComparisonMode === "date") {
            updateComparison({
                dates: addUnique(comparison.dates, nextValue ?? comparison.date),
            });
        }
        if (activeComparisonMode === "month") {
            updateComparison({
                months: addUnique(comparison.months, nextValue ?? comparison.month),
            });
        }
        if (activeComparisonMode === "year") {
            updateComparison({
                years: addUnique(comparison.years, nextValue ?? comparison.year),
            });
        }
    };

    const removeComparisonValue = (mode: RevenueCompareMode, value: string) => {
        if (mode === "date")
            updateComparison({
                dates: comparison.dates.filter((item) => item !== value),
            });
        if (mode === "month")
            updateComparison({
                months: comparison.months.filter((item) => item !== value),
            });
        if (mode === "year")
            updateComparison({
                years: comparison.years.filter((item) => item !== value),
            });
    };

    return (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                    <div className="flex w-full overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface-card)] md:w-auto">
                        {modeKeys.map((mode) => {
                            const active = filter.mode === mode;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => update({ mode })}
                                    className={`h-8 flex-1 shrink-0 rounded-[var(--radius-sm)] px-3 text-xs font-semibold transition-all duration-150 ${active
                                            ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                            : "text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text-primary)]"
                                        }`}
                                >
                                    {d.filters.modes[mode]}
                                </button>
                            );
                        })}
                    </div>

                    <RevenueFilterDateFields
                        filter={filter}
                        labels={d.filters}
                        onChange={update}
                    />

                    {showComparison && (
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 border-t border-[var(--color-border-subtle)] pt-2 md:border-l md:border-t-0 md:pl-2 md:pt-0">
                            <button
                                type="button"
                                onClick={() =>
                                    updateComparison({
                                        mode: comparisonEnabled ? "none" : "previous",
                                    })
                                }
                                className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-xs font-semibold transition-all duration-150 ${comparisonEnabled
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text-primary)]"
                                    }`}
                            >
                                <span
                                    className={`h-4 w-7 rounded-full p-0.5 transition-colors ${comparisonEnabled ? "bg-white/25" : "bg-[var(--color-neutral-200)]"}`}
                                >
                                    <span
                                        className={`block h-3 w-3 rounded-full bg-white transition-transform ${comparisonEnabled ? "translate-x-3" : ""}`}
                                    />
                                </span>
                                <span className="whitespace-nowrap">
                                    {d.filters.compareLabel}
                                </span>
                            </button>

                            {comparisonEnabled && (
                                <>
                                    <select
                                        value={activeComparisonMode}
                                        onChange={(event) =>
                                            updateComparison({
                                                mode: event.target.value as RevenueCompareMode,
                                            })
                                        }
                                        className="h-8 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-2 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition-colors hover:bg-white focus:border-[var(--color-brand-primary)]"
                                    >
                                        {comparisonModeKeys.map((mode) => (
                                            <option key={mode} value={mode}>
                                                {d.filters.compareModes[mode]}
                                            </option>
                                        ))}
                                    </select>

                                    <RevenueComparisonDateFields
                                        mode={activeComparisonMode}
                                        comparison={comparison}
                                        labels={d.filters}
                                        onChange={updateComparison}
                                        onCommit={addComparisonValue}
                                    />

                                    <RevenueActiveComparisonChips
                                        mode={activeComparisonMode}
                                        comparison={comparison}
                                        onRemove={removeComparisonValue}
                                    />

                                    {comparisonLabel && (
                                        <span
                                            title={comparisonLabel}
                                            className="max-w-[260px] truncate rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-xxs font-semibold text-[var(--color-text-muted)]"
                                        >
                                            {comparisonLabel}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="md:flex hidden h-8 shrink-0 items-center gap-2 rounded-full bg-[var(--color-surface-card)] px-2.5 text-xs font-semibold text-[var(--color-text-muted)] xl:ml-2">
                    <Clock3 size={14} className={syncing ? "animate-pulse" : ""} />
                    <span className="hidden whitespace-nowrap sm:inline">
                        {d.generatedAt}
                    </span>
                    <span className="max-w-[190px] truncate text-[var(--color-text-primary)]">
                        {generatedAtLabel}
                    </span>
                </div>
            </div>
        </section>
    );
}

function getComparisonModes(mode: RevenueDateMode): RevenueCompareMode[] {
    if (mode === "today" || mode === "date") return ["previous", "date"];
    if (mode === "month") return ["previous", "month"];
    if (mode === "year") return ["previous", "year"];
    return ["previous", "custom"];
}

function addUnique(values: string[], value: string): string[] {
    if (!value || values.includes(value)) return values;
    return [...values, value];
}
