"use client";

import type { RevenueDateMode } from "@bduck/shared-types";

import {
    getRevenueChartRangeOptions,
    type RevenueChartRange,
} from "@/hooks/revenueChartRange";
import { useTranslation } from "@/lib/i18n";

const QUARTER_OPTIONS: RevenueChartRange[] = [
    "quarter1",
    "quarter2",
    "quarter3",
    "quarter4",
];

export default function RevenueChartRangeSelector({
    value,
    onChange,
    mode = "date",
}: {
    value: RevenueChartRange;
    onChange: (value: RevenueChartRange) => void;
    mode?: RevenueDateMode;
}) {
    const { t } = useTranslation();
    const copy = t.revenue.charts;
    const options = getRevenueChartRangeOptions(mode);
    const buttonOptions = options.filter(
        (option) => !QUARTER_OPTIONS.includes(option),
    );
    const quarterOptions = options.filter((option) =>
        QUARTER_OPTIONS.includes(option),
    );
    const selectedQuarter = quarterOptions.includes(value) ? value : "";

    return (
        <div
            className="w-full overflow-x-auto pb-0.5 sm:w-auto"
            role="group"
            aria-label={copy.rangeLabel}
        >
            <div className="flex  gap-1 rounded-[var(--radius-md)]">
                {buttonOptions.map((option) => {
                    const selected = option === value;
                    return (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(option)}
                            className={`min-h-9 flex-1 whitespace-nowrap rounded-[var(--radius-sm)] px-2 text-xxs font-semibold transition-colors sm:min-h-8 ${selected
                                ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            {copy.rangeOptions[option]}
                        </button>
                    );
                })}
                {quarterOptions.length > 0 && (
                    <select
                        aria-label={copy.quarterLabel}
                        value={selectedQuarter}
                        onChange={(event) =>
                            onChange(event.target.value as RevenueChartRange)
                        }
                        className={`min-h-9 rounded-[var(--radius-sm)] border-0 px-2 text-xxs font-semibold outline-none transition-colors sm:min-h-8 ${selectedQuarter
                            ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                            : "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                            }`}
                    >
                        <option value="" disabled>
                            {copy.quarterLabel}
                        </option>
                        {quarterOptions.map((option) => (
                            <option key={option} value={option}>
                                {copy.rangeOptions[option]}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
}
