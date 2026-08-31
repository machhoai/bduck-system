"use client";

import type { ReactNode } from "react";

import { useTranslation } from "@/lib/i18n";

import {
  formatCurrency,
  sumComparablePointValue,
  type ComparableRevenueChartPoint,
} from "./revenueDashboardUtils";

export function RevenueChartSummary({
  points,
}: {
  points: ComparableRevenueChartPoint[];
}) {
  const { t, lang } = useTranslation();
  const copy = t.revenue;
  const locale = lang === "zh" ? "zh-CN" : "vi-VN";
  const highlighted = points.filter((point) => point.highlighted);
  const scoped = highlighted.length > 0 ? highlighted : points;
  const revenue = sumComparablePointValue(scoped, "revenue");
  const orders = sumComparablePointValue(scoped, "orderCount");

  return (
    <div className="flex h-full flex-col justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryBox
          label={copy.charts.highlightedDays}
          value={(highlighted.length || points.length).toLocaleString(locale)}
        />
        <SummaryBox
          label={copy.stats.totalRevenue}
          value={formatCurrency(revenue.current)}
          comparison={
            revenue.comparison ? formatCurrency(revenue.comparison) : undefined
          }
          highlight
        />
        <SummaryBox
          label={copy.stats.totalOrders}
          value={orders.current.toLocaleString(locale)}
          comparison={
            orders.comparison
              ? orders.comparison.toLocaleString(locale)
              : undefined
          }
        />
      </div>
    </div>
  );
}

export function RevenueChartShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-[360px] flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <p className="text-xxs text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        {actions && <div className="w-full shrink-0 sm:w-auto">{actions}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function RevenueEmptyChart() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)]">
      {t.common.noData}
    </div>
  );
}

export function isComparisonTooltip(
  label: string | undefined,
  comparisonLabel: string | undefined,
  comparisonLineLabel: string,
): boolean {
  if (!label) return false;
  if (
    label === comparisonLineLabel ||
    label.startsWith(`${comparisonLineLabel} - `)
  ) {
    return true;
  }
  return Boolean(comparisonLabel && label.includes(comparisonLabel));
}

export function getRevenueTooltipTitle(
  point: ComparableRevenueChartPoint | undefined,
  comparison: boolean | undefined,
): string {
  if (!point) return "";
  if (comparison && point.comparisonTooltipLabel) {
    return point.comparisonTooltipLabel;
  }
  return point.tooltipLabel ?? point.label ?? point.key;
}

export function withRevenuePeriodLabel(label: string, period?: string): string {
  return period ? `${label} - ${period}` : label;
}

function SummaryBox({
  label,
  value,
  comparison,
  highlight = false,
}: {
  label: string;
  value: string;
  comparison?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
      <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 tabular-nums ${highlight ? "text-base font-bold text-[var(--color-brand-primary)]" : "text-sm font-semibold text-[var(--color-text-primary)]"}`}
      >
        {value}
      </p>
      {comparison && (
        <p className="mt-0.5 truncate text-xxs tabular-nums text-[var(--color-text-muted)]">
          {comparison}
        </p>
      )}
    </div>
  );
}
