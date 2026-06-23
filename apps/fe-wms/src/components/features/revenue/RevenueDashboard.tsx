"use client";

import { AlertTriangle, Clock3, MapPin } from "lucide-react";
import { useState } from "react";
import {
  getDefaultRevenueFilter,
  useRevenueDashboard,
  type RevenueDashboardFilter,
} from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import RevenueCharts from "./RevenueCharts";
import RevenueDateFilter from "./RevenueDateFilter";
import RevenueDashboardSkeleton from "./RevenueDashboardSkeleton";
import RevenueStats from "./RevenueStats";
import TopProductsByGroup from "./TopProductsByGroup";

export default function RevenueDashboard() {
  const { t } = useTranslation();
  const d = t.revenue;
  const [filter, setFilter] = useState<RevenueDashboardFilter>(() => getDefaultRevenueFilter());
  const { data, loading, error } = useRevenueDashboard(filter);

  return (
    <div className="flex w-full flex-col gap-4">
      <RevenueDateFilter filter={filter} onChange={setFilter} />

      {error && (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && <RevenueDashboardSkeleton />}

      {!loading && data && (
        <>
          {/* Context bar */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-white">
                <MapPin size={14} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{data.warehouseName}</p>
                <p className="text-xxs text-[var(--color-text-muted)]">{data.range.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-3">
              <Clock3 size={15} className="shrink-0 text-[var(--color-text-muted)]" />
              <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {d.generatedAt}
                </p>
                <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                  {new Date(data.generatedAt).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
          </div>

          <RevenueStats data={data} />
          <RevenueCharts points={data.charts.points} paymentMethods={data.charts.paymentMethods} />
          <TopProductsByGroup groups={data.topProductGroups} />
        </>
      )}
    </div>
  );
}
