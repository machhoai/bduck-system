"use client";

import type { RevenueChartRange } from "@/hooks/revenueChartRange";
import { useTranslation } from "@/lib/i18n";

const OPTIONS: RevenueChartRange[] = ["week", "month", "last7", "last30"];

export default function RevenueChartRangeSelector({
    value,
    onChange,
}: {
    value: RevenueChartRange;
    onChange: (value: RevenueChartRange) => void;
}) {
    const { t } = useTranslation();
    const copy = t.revenue.charts;

    return (
        <div
            className="w-full overflow-x-auto pb-0.5 sm:w-auto"
            role="group"
            aria-label={copy.rangeLabel}
        >
            <div className="grid min-w-[276px] grid-cols-4 gap-1 rounded-[var(--radius-md)]">
                {OPTIONS.map((option) => {
                    const selected = option === value;
                    return (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(option)}
                            className={`min-h-9 whitespace-nowrap rounded-[var(--radius-sm)] px-2 text-xxs font-semibold transition-colors sm:min-h-8 ${selected
                                    ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            {copy.rangeOptions[option]}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
