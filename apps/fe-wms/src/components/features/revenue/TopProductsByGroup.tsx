"use client";

import type { TopProductGroup } from "@bduck/shared-types";
import { Boxes, Trophy } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { formatCurrency, formatNumber } from "./revenueDashboardUtils";

const GROUP_LIMIT = 6;
const ITEM_LIMIT = 3;

interface TopProductsByGroupProps {
  groups: TopProductGroup[];
}

export default function TopProductsByGroup({
  groups,
}: TopProductsByGroupProps) {
  const { t } = useTranslation();
  const copy = t.revenue.topProducts;
  const visibleGroups = groups.slice(0, GROUP_LIMIT);
  const totalRevenue = groups.reduce((sum, group) => sum + group.revenue, 0);

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-soft)] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-amber-50 text-amber-700">
            <Trophy size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {copy.title}
            </h2>
            <p className="mt-0.5 truncate text-xxs text-[var(--color-text-muted)]">
              {copy.subtitle}
            </p>
          </div>
        </div>
        {groups.length > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-xxs font-medium text-[var(--color-text-muted)]">
            Top {Math.min(groups.length, GROUP_LIMIT)}
          </span>
        )}
      </div>

      {visibleGroups.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {visibleGroups.map((group, index) => (
            <article
              key={group.groupName}
              className="border-b border-[var(--color-border-soft)] p-4 last:border-b-0 lg:odd:border-r lg:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-muted)] text-xs font-bold text-[var(--color-brand-primary)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {group.groupName}
                    </h3>
                    <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
                      {formatNumber(group.quantity)} {copy.units}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {formatCurrency(group.revenue)}
                  </p>
                  <p className="mt-0.5 text-xxs font-medium tabular-nums text-[var(--color-brand-primary)]">
                    {totalRevenue > 0
                      ? `${((group.revenue / totalRevenue) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {group.items.slice(0, ITEM_LIMIT).map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Boxes
                        size={13}
                        className="shrink-0 text-[var(--color-text-muted)]"
                        aria-hidden="true"
                      />
                      <span className="truncate text-xs text-[var(--color-text-primary)]">
                        {item.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                      {formatNumber(item.quantity)} ·{" "}
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t.revenue.empty.noTopProducts}
        </div>
      )}
    </section>
  );
}
