"use client";

import { useRef } from "react";

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
    showComparison?: boolean;
}

const modeKeys: RevenueDateMode[] = [
    "date",
    "month",
    "year",
    "custom",
];

export default function RevenueDateFilter({
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
        <div className="rounded-[var(--radius-lg)] relative md:top-2 z-50 border border-[var(--color-border-subtle)] max-w-70 md:max-w-full mx-auto bg-[var(--color-surface-elevated)] p-1 shadow-sm">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                    <div className="flex w-full overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface-card)]">
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

                    <FilterDateFields
                        filter={filter}
                        labels={d.filters}
                        onChange={update}
                    />

                    {showComparison && (
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:border-l lg:border-[var(--color-border-subtle)] lg:pl-2">
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

                                    <ComparisonDateFields
                                        mode={activeComparisonMode}
                                        comparison={comparison}
                                        labels={d.filters}
                                        onChange={updateComparison}
                                        onCommit={addComparisonValue}
                                    />

                                    <ActiveComparisonChips
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

function FilterDateFields({
    filter,
    labels,
    onChange,
}: {
    filter: RevenueDashboardFilter;
    labels: ReturnType<typeof useTranslation>["t"]["revenue"]["filters"];
    onChange: (patch: Partial<RevenueDashboardFilter>) => void;
}) {
    if (filter.mode === "date") {
        return (
            <DateInput
                label={labels.date}
                type="date"
                value={filter.date}
                onChange={(value) => onChange({ date: value })}
            />
        );
    }

    if (filter.mode === "month") {
        return (
            <DateInput
                label={labels.month}
                type="month"
                value={filter.month}
                onChange={(value) => onChange({ month: value })}
            />
        );
    }

    if (filter.mode === "year") {
        return (
            <DateInput
                label={labels.year}
                type="number"
                value={filter.year}
                onChange={(value) => onChange({ year: value })}
            />
        );
    }

    if (filter.mode === "custom") {
        return (
            <div className="flex w-full">
                <DateInput
                    label=""
                    type="date"
                    value={filter.startDate}
                    onChange={(value) => onChange({ startDate: value })}
                />
                <DateInput
                    label=""
                    type="date"
                    value={filter.endDate}
                    onChange={(value) => onChange({ endDate: value })}
                />
            </div>
        );
    }

    return null;
}

function ComparisonDateFields({
    mode,
    comparison,
    labels,
    onChange,
    onCommit,
}: {
    mode: RevenueCompareMode;
    comparison: RevenueComparisonSelection;
    labels: ReturnType<typeof useTranslation>["t"]["revenue"]["filters"];
    onChange: (patch: Partial<RevenueComparisonSelection>) => void;
    onCommit: (value?: string) => void;
}) {
    if (mode === "date") {
        return (
            <MultiValueInput
                label={labels.date}
                type="date"
                value={comparison.date}
                onChange={(value) => onChange({ date: value })}
                onCommit={onCommit}
            />
        );
    }

    if (mode === "month") {
        return (
            <MultiValueInput
                label={labels.month}
                type="month"
                value={comparison.month}
                onChange={(value) => onChange({ month: value })}
                onCommit={onCommit}
            />
        );
    }

    if (mode === "year") {
        return (
            <MultiValueInput
                label={labels.year}
                type="number"
                value={comparison.year}
                onChange={(value) => onChange({ year: value })}
                onCommit={onCommit}
            />
        );
    }

    if (mode === "custom") {
        return (
            <>
                <DateInput
                    label=""
                    type="date"
                    value={comparison.startDate}
                    onChange={(value) => onChange({ startDate: value })}
                />
                <DateInput
                    label=""
                    type="date"
                    value={comparison.endDate}
                    onChange={(value) => onChange({ endDate: value })}
                />
            </>
        );
    }

    return null;
}

function ActiveComparisonChips({
    mode,
    comparison,
    onRemove,
}: {
    mode: RevenueCompareMode;
    comparison: RevenueComparisonSelection;
    onRemove: (mode: RevenueCompareMode, value: string) => void;
}) {
    if (mode === "date" && comparison.dates.length > 0) {
        return (
            <ComparisonChips
                values={comparison.dates}
                onRemove={(value) => onRemove("date", value)}
            />
        );
    }

    if (mode === "month" && comparison.months.length > 0) {
        return (
            <ComparisonChips
                values={comparison.months}
                onRemove={(value) => onRemove("month", value)}
            />
        );
    }

    if (mode === "year" && comparison.years.length > 0) {
        return (
            <ComparisonChips
                values={comparison.years}
                onRemove={(value) => onRemove("year", value)}
            />
        );
    }

    return null;
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
        if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(nextValue))
            onCommit(nextValue);
        if (type === "month" && /^\d{4}-\d{2}$/.test(nextValue))
            onCommit(nextValue);
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)]"
                aria-label="Add comparison value"
            >
                <Plus size={14} />
            </button>
        </div>
    );
}

function ComparisonChips({
    values,
    onRemove,
}: {
    values: string[];
    onRemove: (value: string) => void;
}) {
    return (
        <div className="flex max-w-full gap-1 overflow-x-auto py-0.5">
            {values.map((value) => (
                <span
                    key={value}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-surface-card)] px-2 text-xs font-semibold text-[var(--color-text-primary)]"
                >
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

function DateInput({
    label,
    type,
    value,
    onChange,
}: {
    label: string;
    type: "date" | "month" | "number";
    value: string;
    onChange: (v: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);

    const handleClick = () => {
        if (type !== "number" && inputRef.current && typeof inputRef.current.showPicker === "function") {
            try {
                inputRef.current.showPicker();
            } catch (err) {
                // Fail-safe for older browsers
            }
        } else if (type === "number" && selectRef.current && typeof selectRef.current.showPicker === "function") {
            try {
                selectRef.current.showPicker();
            } catch (err) {
                // Fail-safe for older browsers
            }
        }
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear + 5 - 2020 + 1 }, (_, i) => String(2020 + i));

    return (
        <div
            onClick={handleClick}
            className="flex flex-1 h-8 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] px-2 transition-colors focus-within:border-[var(--color-brand-primary)] focus-within:bg-white cursor-pointer"
            style={{ width: type === "number" ? "112px" : "156px" }}
        >
            {label && (
                <span className="max-w-[58px] truncate whitespace-nowrap text-xs font-semibold text-[var(--color-text-muted)] select-none">
                    {label}
                </span>
            )}
            {type === "number" ? (
                <select
                    ref={selectRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-7 min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--color-text-primary)] outline-none cursor-pointer"
                >
                    {years.map((y) => (
                        <option key={y} value={y} className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]">
                            {y}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    ref={inputRef}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-7 min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--color-text-primary)] outline-none cursor-pointer"
                />
            )}
        </div>
    );
}
