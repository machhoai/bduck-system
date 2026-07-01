"use client";

import type {
    RevenueCompareMode,
    RevenueComparisonSelection,
    RevenueDashboardFilter,
    RevenueDateMode,
} from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import { Clock3, Plus, X } from "lucide-react";

interface RevenueDateFilterProps {
    filter: RevenueDashboardFilter;
    comparison: RevenueComparisonSelection;
    comparisonLabel: string;
    onChange: (filter: RevenueDashboardFilter) => void;
    onComparisonChange: (comparison: RevenueComparisonSelection) => void;
    generatedAt?: string;
    syncing?: boolean;
}

const modeKeys: RevenueDateMode[] = ["today", "date", "month", "year", "custom"];

export default function RevenueDateFilter({
    filter,
    comparison,
    comparisonLabel,
    onChange,
    onComparisonChange,
    generatedAt,
    syncing,
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
    const activeComparisonMode = comparisonModeKeys.includes(comparison.mode) ? comparison.mode : "previous";

    const addComparisonValue = (nextValue?: string) => {
        if (activeComparisonMode === "date") {
            updateComparison({ dates: addUnique(comparison.dates, nextValue ?? comparison.date) });
        }
        if (activeComparisonMode === "month") {
            updateComparison({ months: addUnique(comparison.months, nextValue ?? comparison.month) });
        }
        if (activeComparisonMode === "year") {
            updateComparison({ years: addUnique(comparison.years, nextValue ?? comparison.year) });
        }
    };

    const removeComparisonValue = (mode: RevenueCompareMode, value: string) => {
        if (mode === "date") updateComparison({ dates: comparison.dates.filter((item) => item !== value) });
        if (mode === "month") updateComparison({ months: comparison.months.filter((item) => item !== value) });
        if (mode === "year") updateComparison({ years: comparison.years.filter((item) => item !== value) });
    };

    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
            <div className="flex flex-col gap-3">

                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-[var(--color-surface-card)] p-1">
                            {modeKeys.map((mode) => {
                                const active = filter.mode === mode;
                                return (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => update({ mode })}
                                        className={`h-8 rounded-[var(--radius-sm)] px-3 text-xs font-semibold transition-all duration-150 ${active
                                            ? "bg-[var(--color-brand-primary)] text-white"
                                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                                            }`}
                                    >
                                        {d.filters.modes[mode]}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {filter.mode === "date" && (
                                <DateInput label={d.filters.date} type="date" value={filter.date} onChange={(v) => update({ date: v })} />
                            )}
                            {filter.mode === "month" && (
                                <DateInput label={d.filters.month} type="month" value={filter.month} onChange={(v) => update({ month: v })} />
                            )}
                            {filter.mode === "year" && (
                                <DateInput label={d.filters.year} type="number" value={filter.year} onChange={(v) => update({ year: v })} />
                            )}
                            {filter.mode === "custom" && (
                                <>
                                    <DateInput label={d.filters.startDate} type="date" value={filter.startDate} onChange={(v) => update({ startDate: v })} />
                                    <DateInput label={d.filters.endDate} type="date" value={filter.endDate} onChange={(v) => update({ endDate: v })} />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-2">
                        <Clock3 size={18} className="shrink-0 text-[var(--color-text-muted)]" />
                        <div className="min-w-0">
                            <p className="text-xxs font-semibold tracking-wide text-[var(--color-text-muted)]">
                                {d.generatedAt}
                            </p>
                            <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                {syncing ? d.syncing : generatedAt ? new Date(generatedAt).toLocaleString("vi-VN") : "---"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-2 lg:flex-row lg:items-center">
                    <button
                        type="button"
                        onClick={() => updateComparison({ mode: comparisonEnabled ? "none" : "previous" })}
                        className={`flex h-8 w-fit items-center gap-2 rounded-[var(--radius-sm)] px-3 text-xs font-semibold transition-all duration-150 ${comparisonEnabled
                            ? "bg-[var(--color-brand-primary)] text-white"
                            : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            }`}
                    >
                        <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${comparisonEnabled ? "bg-white/25" : "bg-[var(--color-neutral-200)]"}`}>
                            <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${comparisonEnabled ? "translate-x-3" : ""}`} />
                        </span>
                        {d.filters.compareLabel}
                    </button>

                    {comparisonEnabled && (
                        <>
                            <div className="flex flex-wrap gap-1">
                                {comparisonModeKeys.map((mode) => {
                                    const active = activeComparisonMode === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => updateComparison({ mode })}
                                            className={`h-8 rounded-[var(--radius-sm)] px-3 text-xs font-semibold transition-all duration-150 ${active
                                                ? "bg-[var(--color-neutral-900)] text-white"
                                                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                                }`}
                                        >
                                            {d.filters.compareModes[mode]}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {activeComparisonMode === "date" && (
                                    <MultiValueInput label={d.filters.date} type="date" value={comparison.date} onChange={(v) => updateComparison({ date: v })} onCommit={addComparisonValue} />
                                )}
                                {activeComparisonMode === "month" && (
                                    <MultiValueInput label={d.filters.month} type="month" value={comparison.month} onChange={(v) => updateComparison({ month: v })} onCommit={addComparisonValue} />
                                )}
                                {activeComparisonMode === "year" && (
                                    <MultiValueInput label={d.filters.year} type="number" value={comparison.year} onChange={(v) => updateComparison({ year: v })} onCommit={addComparisonValue} />
                                )}
                                {activeComparisonMode === "custom" && (
                                    <>
                                        <DateInput label={d.filters.startDate} type="date" value={comparison.startDate} onChange={(v) => updateComparison({ startDate: v })} />
                                        <DateInput label={d.filters.endDate} type="date" value={comparison.endDate} onChange={(v) => updateComparison({ endDate: v })} />
                                    </>
                                )}
                            </div>

                            {activeComparisonMode === "date" && comparison.dates.length > 0 && (
                                <ComparisonChips values={comparison.dates} onRemove={(value) => removeComparisonValue("date", value)} />
                            )}
                            {activeComparisonMode === "month" && comparison.months.length > 0 && (
                                <ComparisonChips values={comparison.months} onRemove={(value) => removeComparisonValue("month", value)} />
                            )}
                            {activeComparisonMode === "year" && comparison.years.length > 0 && (
                                <ComparisonChips values={comparison.years} onRemove={(value) => removeComparisonValue("year", value)} />
                            )}

                            {comparisonLabel && (
                                <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] px-2 py-1 text-xxs font-semibold text-[var(--color-text-muted)]">
                                    {comparisonLabel}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
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

function MultiValueInput({
    label,
    type,
    value,
    onChange,
    onCommit,
}: {
    label: string;
    type: "date" | "month" | "number";
    value: string;
    onChange: (v: string) => void;
    onCommit: (value?: string) => void;
}) {
    const commitIfComplete = (nextValue: string) => {
        if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(nextValue)) onCommit(nextValue);
        if (type === "month" && /^\d{4}-\d{2}$/.test(nextValue)) onCommit(nextValue);
        if (type === "number" && /^\d{4}$/.test(nextValue)) onCommit(nextValue);
    };

    return (
        <div className="flex items-center gap-1">
            <DateInput
                label={label}
                type={type}
                value={value}
                onChange={(nextValue) => {
                    onChange(nextValue);
                    commitIfComplete(nextValue);
                }}
            />
            <button
                type="button"
                onClick={() => onCommit()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                aria-label="Add comparison value"
            >
                <Plus size={14} />
            </button>
        </div>
    );
}

function ComparisonChips({ values, onRemove }: { values: string[]; onRemove: (value: string) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {values.map((value) => (
                <span key={value} className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--color-surface-card)] px-2 text-xs font-semibold text-[var(--color-text-primary)]">
                    {value}
                    <button
                        type="button"
                        onClick={() => onRemove(value)}
                        className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)]"
                        aria-label={`Remove ${value}`}
                    >
                        <X size={10} />
                    </button>
                </span>
            ))}
        </div>
    );
}

function DateInput({ label, type, value, onChange }: { label: string; type: "date" | "month" | "number"; value: string; onChange: (v: string) => void }) {
    return (
        <label className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-2">
            <span className="whitespace-nowrap text-xxs font-semibold tracking-wide text-[var(--color-text-muted)]">
                {label}
            </span>
            <input
                type={type}
                value={value}
                min={type === "number" ? "2020" : undefined}
                max={type === "number" ? "2100" : undefined}
                onChange={(e) => onChange(e.target.value)}
                className="h-7 min-w-0 bg-transparent text-xs font-semibold text-[var(--color-text-primary)] outline-none"
            />
        </label>
    );
}
