"use client";

import { useRevenueDashboard, type RevenueDashboardFilter, type RevenueDateMode } from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import { Clock3, MapPin } from "lucide-react";

interface RevenueDateFilterProps {
    filter: RevenueDashboardFilter;
    onChange: (filter: RevenueDashboardFilter) => void;
}

const modeKeys: RevenueDateMode[] = ["today", "date", "month", "year", "custom"];

export default function RevenueDateFilter({ filter, onChange }: RevenueDateFilterProps) {
    const { t } = useTranslation();
    const { data, loading, error } = useRevenueDashboard(filter);
    const d = t.revenue;

    const update = (patch: Partial<RevenueDashboardFilter>) => {
        onChange({ ...filter, ...patch });
    };

    return (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">

                <div className="flex gap-3">
                    <div className="flex flex-wrap gap-1.5">
                        {modeKeys.map((mode) => {
                            const active = filter.mode === mode;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => update({ mode })}
                                    className={`h-8 rounded-full px-3 text-xs font-semibold transition-all duration-150 ${active
                                        ? "bg-[var(--color-brand-primary)] text-white"
                                        : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
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
                            {data?.generatedAt ? new Date(data.generatedAt).toLocaleString("vi-VN") : "---"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DateInput({ label, type, value, onChange }: { label: string; type: "date" | "month" | "number"; value: string; onChange: (v: string) => void }) {
    return (
        <label className="flex items-center gap-2 ">
            <span className="text-xxs font-semibold tracking-wide text-[var(--color-text-muted)]">
                {label}
            </span>
            <input
                type={type}
                value={value}
                min={type === "number" ? "2020" : undefined}
                max={type === "number" ? "2100" : undefined}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] px-3 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition-all duration-150 focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
            />
        </label>
    );
}
