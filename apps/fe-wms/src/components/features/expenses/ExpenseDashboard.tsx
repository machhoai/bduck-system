"use client";

import { useTranslation } from "@/lib/i18n";
import {
  useExpenseDashboardMetrics,
  type DashboardKPI,
  type CostCenterBreakdown,
} from "@/hooks/useExpenseDashboardMetrics";
import {
  AlertTriangle,
  DollarSign,
  Percent,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const KPI_ICONS = [DollarSign, Receipt, PiggyBank, Percent] as const;
const KPI_COLORS = [
  "border-brand-primary/20 bg-brand-primary-muted text-brand-primary",
  "border-accent-warning/20 bg-accent-warning/10 text-accent-warning",
  "border-accent-success/20 bg-accent-success/10 text-accent-success",
  "border-accent-info/20 bg-accent-info/10 text-accent-info",
] as const;

function KPICard({
  title,
  kpi,
  suffix,
  formatValue,
  index,
}: {
  title: string;
  kpi: DashboardKPI;
  suffix?: string;
  formatValue?: (v: number) => string;
  index: number;
}) {
  const displayValue = formatValue
    ? formatValue(kpi.value)
    : kpi.value.toLocaleString("vi-VN");
  const trendUp = kpi.trend > 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  const trendColor = trendUp ? "text-accent-success" : "text-accent-error";
  const trendBg = trendUp ? "bg-accent-success/8" : "bg-accent-error/8";
  const Icon = KPI_ICONS[index] || DollarSign;
  const colorClass = KPI_COLORS[index] || KPI_COLORS[0];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border ${colorClass}`}>
          <Icon size={20} strokeWidth={1.7} />
        </div>
        <span className="truncate text-xs font-medium text-[var(--color-text-muted)]">
          {title}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-lg font-semibold leading-none tracking-tight tabular-nums text-[var(--color-text-primary)]">
          {displayValue}{suffix}
        </span>
        <span className={`inline-flex h-5 items-center gap-0.5 rounded-radius-pill px-1.5 text-micro font-bold tabular-nums ${trendBg} ${trendColor}`}>
          <TrendIcon size={10} strokeWidth={2.5} />
          {Math.abs(kpi.trend).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function TrendChart({
  data,
  title,
  legendRevenue,
  legendExpenses,
}: {
  data: { month: string; revenue: number; expenses: number }[];
  title: string;
  legendRevenue: string;
  legendExpenses: string;
}) {
  const maxValue = Math.max(...data.flatMap((d) => [d.revenue, d.expenses]), 1);

  return (
    <div className="flex flex-1 flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-radius-pill bg-brand-primary/80" />
            <span className="text-micro text-text-muted">{legendRevenue}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-radius-pill bg-accent-error/60" />
            <span className="text-micro text-text-muted">{legendExpenses}</span>
          </div>
        </div>
      </div>

      <div className="grid h-[260px] grid-cols-6 items-end gap-2">
        {data.map((point) => (
          <div key={point.month} className="flex h-full flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-1 pb-1">
              <div
                className="min-h-1 flex-1 rounded-t-sm bg-brand-primary/80 transition-all duration-300"
                style={{ height: `${(point.revenue / maxValue) * 100}%` }}
              />
              <div
                className="min-h-1 flex-1 rounded-t-sm bg-accent-error/60 transition-all duration-300"
                style={{ height: `${(point.expenses / maxValue) * 100}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-micro text-text-muted">
              {point.month}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({
  data,
  title,
  t,
  formatValue,
}: {
  data: CostCenterBreakdown[];
  title: string;
  t: Record<string, string>;
  formatValue: (v: number) => string;
}) {
  let cumulativePct = 0;
  const stops = data.map((segment) => {
    const start = cumulativePct;
    cumulativePct += segment.percentage;
    return `${segment.color} ${start}% ${cumulativePct}%`;
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;
  const total = data.reduce((sum, segment) => sum + segment.amount, 0);

  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5 lg:w-[360px]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <span className="text-xxs font-bold tabular-nums text-text-primary">
          {formatValue(total)}
        </span>
      </div>

      <div className="grid min-h-[260px] grid-cols-[112px_minmax(0,1fr)] items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <div
            className="h-full w-full rounded-full"
            style={{ background: gradient }}
          />
          <div className="absolute inset-3 flex items-center justify-center rounded-full bg-surface-elevated">
            <span className="text-sm font-bold tabular-nums text-text-primary">
              {data[0]?.percentage ?? 0}%
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {data.map((segment) => {
            const label = t[segment.costCenter] || segment.costCenter;
            return (
              <div key={segment.costCenter} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-radius-xs"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="truncate text-xxs font-medium text-text-secondary">{label}</span>
                <span className="text-xxs font-bold tabular-nums text-text-primary">
                  {segment.percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OverBudgetAlerts({
  stores,
  title,
  emptyText,
  formatValue,
}: {
  stores: { warehouseName: string; budgetUsed: number; totalBudget: number; totalActual: number }[];
  title: string;
  emptyText: string;
  formatValue: (v: number) => string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        {stores.length > 0 && (
          <span className="inline-flex h-5 items-center gap-1 rounded-radius-pill bg-accent-error/10 px-2 text-micro font-bold text-accent-error">
            <AlertTriangle size={10} />
            {stores.length}
          </span>
        )}
      </div>

      {stores.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">{emptyText}</p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {stores.map((store) => {
            const isOver = store.budgetUsed > 100;
            return (
              <div key={store.warehouseName} className="rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-text-primary">
                    {store.warehouseName}
                  </span>
                  <span className={`text-xxs font-bold tabular-nums ${isOver ? "text-accent-error" : "text-accent-success"}`}>
                    {store.budgetUsed}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-radius-pill bg-surface-base">
                  <div
                    className={`h-full rounded-radius-pill transition-all duration-500 ${
                      isOver ? "bg-accent-error" : "bg-accent-success"
                    }`}
                    style={{ width: `${Math.min(store.budgetUsed, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between gap-2 text-micro tabular-nums text-text-muted">
                  <span>{formatValue(store.totalBudget)}</span>
                  <span>{formatValue(store.totalActual)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExpenseDashboard({
  warehouseId,
  period,
}: {
  warehouseId: string;
  period: string;
}) {
  const { t } = useTranslation();
  const { metrics, loading, error } = useExpenseDashboardMetrics(warehouseId, period);

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} tr`;
    return value.toLocaleString("vi-VN");
  };

  if (error) {
    return (
      <div className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-accent-error/20 bg-accent-error/5 p-4">
        <AlertTriangle size={16} className="shrink-0 text-accent-error" />
        <span className="text-xs text-accent-error">{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[340px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]" />
          <div className="h-[340px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
        <KPICard
          title={t.expenses.dashboard.grossRevenue}
          kpi={metrics.grossRevenue}
          suffix=" đ"
          formatValue={formatCurrency}
          index={0}
        />
        <KPICard
          title={t.expenses.dashboard.totalExpenses}
          kpi={metrics.totalExpenses}
          suffix=" đ"
          formatValue={formatCurrency}
          index={1}
        />
        <KPICard
          title={t.expenses.dashboard.netProfit}
          kpi={metrics.netProfit}
          suffix=" đ"
          formatValue={formatCurrency}
          index={2}
        />
        <KPICard
          title={t.expenses.dashboard.profitMargin}
          kpi={metrics.profitMargin}
          suffix="%"
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TrendChart
          data={metrics.trendData}
          title={t.expenses.dashboard.revenueVsExpenses}
          legendRevenue={t.expenses.dashboard.grossRevenue}
          legendExpenses={t.expenses.dashboard.totalExpenses}
        />
        <DonutChart
          data={metrics.costCenterBreakdown}
          title={t.expenses.dashboard.expenseBreakdown}
          t={t.expenses.costCenter}
          formatValue={formatCurrency}
        />
      </div>

      {warehouseId === "ALL" && (
        <OverBudgetAlerts
          stores={metrics.overBudgetStores}
          title={t.expenses.dashboard.overBudgetStores}
          emptyText={t.expenses.dashboard.noOverBudget}
          formatValue={formatCurrency}
        />
      )}
    </div>
  );
}

