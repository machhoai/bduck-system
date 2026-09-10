"use client";

import type {
  RevenueDashboardData,
  RevenueDataSource,
} from "@bduck/shared-types";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildRevenueChartRangeFilter,
  getRevenueChartAnchorDate,
  type RevenueChartRange,
} from "@/hooks/revenueChartRange";
import { usePosRevenueStats } from "@/hooks/usePosRevenueStats";
import {
  buildRevenueComparisonFilters,
  getDefaultRevenueComparison,
  getDefaultRevenueFilter,
  getRevenueComparisonLabel,
  getRevenueComparisonLabels,
  useRevenueDashboard,
  useRevenueDashboardComparisons,
  type RevenueComparisonSelection,
  type RevenueDashboardFilter,
} from "@/hooks/useRevenueDashboard";
import { useRevenueExportRegistration } from "@/hooks/useRevenueExportRegistration";
import { useRevenueProductGroups } from "@/hooks/useRevenueProductGroups";
import { useRevenueStoreSelection } from "@/hooks/useRevenueStoreSelection";
import { useTranslation } from "@/lib/i18n";

import RevenueCharts from "./RevenueCharts";
import RevenueDashboardSkeleton from "./RevenueDashboardSkeleton";
import {
  RevenueDashboardEmptyState,
  RevenueDashboardError,
} from "./RevenueDashboardStates";
import RevenueDateFilter from "./RevenueDateFilter";
import RevenueKpiGrid from "./RevenueKpiGrid";
import RevenueOrderExplorer from "./RevenueOrderExplorer";
import RevenueSourceTabs from "./RevenueSourceTabs";
import RevenueWarehouseSelect from "./RevenueWarehouseSelect";
import TopProductsByGroup from "./TopProductsByGroup";

export default function RevenueDashboard() {
  const { t } = useTranslation();
  const copy = t.revenue;
  const [source, setSource] = useState<RevenueDataSource>("OPEN_API");
  const [filter, setFilter] = useState<RevenueDashboardFilter>(() =>
    getDefaultRevenueFilter(),
  );
  const [chartRange, setChartRange] = useState<RevenueChartRange>("last7");
  const [comparison, setComparison] = useState<RevenueComparisonSelection>(() =>
    getDefaultRevenueComparison(getDefaultRevenueFilter()),
  );
  const storeSelection = useRevenueStoreSelection(source);
  const { activeWarehouseId, activeWarehouseName, localWarehouseIds } =
    storeSelection;
  const productCatalog = useRevenueProductGroups(
    activeWarehouseId,
    source === "LOCAL_POS" && Boolean(activeWarehouseId),
  );
  const openApiDashboard = useRevenueDashboard(filter, {
    source: "OPEN_API",
    warehouseId: activeWarehouseId,
    enabled: source === "OPEN_API" && Boolean(activeWarehouseId),
  });
  const localDashboard = usePosRevenueStats(
    localWarehouseIds,
    filter,
    productCatalog.groups,
  );
  const chartFilter = useMemo(
    () => buildRevenueChartRangeFilter(filter, chartRange),
    [chartRange, filter],
  );
  const chartRangeEnabled = comparison.mode === "none";
  const openApiChartDashboard = useRevenueDashboard(chartFilter, {
    source: "OPEN_API",
    warehouseId: activeWarehouseId,
    enabled:
      chartRangeEnabled && source === "OPEN_API" && Boolean(activeWarehouseId),
    keepPreviousData: true,
  });
  const localChartDashboard = usePosRevenueStats(
    chartRangeEnabled ? localWarehouseIds : [],
    chartFilter,
    productCatalog.groups,
  );
  const comparisonFilters = useMemo(
    () => buildRevenueComparisonFilters(filter, comparison),
    [comparison, filter],
  );
  const comparisons = useRevenueDashboardComparisons(
    activeWarehouseId ? comparisonFilters : [],
    activeWarehouseId,
    source,
    localWarehouseIds,
    productCatalog.groups,
  );
  const comparisonLabels = useMemo(
    () => getRevenueComparisonLabels(comparisonFilters),
    [comparisonFilters],
  );
  const comparisonLabel = comparisonLabels.join(", ");

  const rawData =
    source === "OPEN_API"
      ? openApiDashboard.data
      : (localDashboard.data?.dashboard ?? null);
  const data = useMemo<RevenueDashboardData | null>(
    () =>
      rawData
        ? {
            ...rawData,
            warehouseName: rawData.warehouseName || activeWarehouseName || "",
          }
        : null,
    [activeWarehouseName, rawData],
  );
  const chartRawData =
    source === "OPEN_API"
      ? openApiChartDashboard.data
      : (localChartDashboard.data?.dashboard ?? null);
  const chartData = chartRangeEnabled ? chartRawData : data;
  const chartAnchorDate = getRevenueChartAnchorDate(filter);
  const chartPoints = useMemo(
    () =>
      (chartData?.charts.points ?? []).map((point) => ({
        ...point,
        highlighted: point.key === chartAnchorDate,
      })),
    [chartAnchorDate, chartData?.charts.points],
  );
  const chartLoading =
    chartRangeEnabled &&
    (source === "OPEN_API"
      ? openApiChartDashboard.loading || openApiChartDashboard.syncing
      : localChartDashboard.loading);
  const loading =
    storeSelection.loading ||
    productCatalog.loading ||
    (source === "OPEN_API" ? openApiDashboard.loading : localDashboard.loading);
  const syncing = openApiDashboard.syncing || comparisons.syncing;
  const error =
    source === "OPEN_API"
      ? storeSelection.error || openApiDashboard.error
      : storeSelection.error || productCatalog.error || localDashboard.error;

  useRevenueExportRegistration({
    source,
    warehouseId: activeWarehouseId,
    warehouseName: activeWarehouseName,
    warehouseIds: source === "LOCAL_POS" ? localWarehouseIds : undefined,
    rangeLabel: getRevenueComparisonLabel(filter) || data?.range.label,
    filter,
    dashboard: data,
    loading,
    error,
  });

  const handleChartPointClick = (key: string) => {
    if (/^\d{4}-\d{2}$/u.test(key)) {
      setFilter((current) => ({ ...current, mode: "month", month: key }));
    } else if (/^\d{4}-\d{2}-\d{2}$/u.test(key)) {
      setFilter((current) => ({ ...current, mode: "date", date: key }));
    }
  };

  return (
    <div className="flex w-full flex-col gap-3 pb-4">
      <header className="flex flex-col gap-3 px-1 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
            <BarChart3 size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
              {copy.title}
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs text-[var(--color-text-muted)]">
              {copy.subtitle}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <RevenueSourceTabs value={source} onChange={setSource} />

        <RevenueWarehouseSelect
          options={storeSelection.options}
          value={activeWarehouseId}
          disabled={storeSelection.loading}
          onChange={storeSelection.selectWarehouse}
        />
      </section>

      {activeWarehouseId && (
        <RevenueDateFilter
          filter={filter}
          comparison={comparison}
          comparisonLabel={comparisonLabel}
          onChange={setFilter}
          onComparisonChange={setComparison}
          generatedAt={data?.generatedAt}
          syncing={syncing}
        />
      )}

      <RevenueDashboardError message={error || comparisons.error} />
      {loading && <RevenueDashboardSkeleton />}
      {!loading && !activeWarehouseId && (
        <RevenueDashboardEmptyState
          label={
            source === "OPEN_API"
              ? copy.sources.noConfiguredWarehouse
              : copy.filters.noWarehouse
          }
        />
      )}

      {!loading && data && (
        <>
          <RevenueKpiGrid data={data} />
          <RevenueCharts
            currentPeriod={{
              key: data.cacheKey,
              label: getRevenueComparisonLabel(filter) || data.range.label,
              revenue: data.stats.totalRevenue.value,
              orderCount: data.stats.totalOrders.value,
              memberCardAmount: 0,
            }}
            comparisonPeriods={comparisons.data.map((item, index) => ({
              key: item.cacheKey,
              label: comparisonLabels[index] ?? item.range.label,
              revenue: item.stats.totalRevenue.value,
              orderCount: item.stats.totalOrders.value,
              memberCardAmount: 0,
            }))}
            points={chartPoints}
            comparisonPoints={comparisons.data[0]?.charts.points}
            paymentMethods={data.charts.paymentMethods}
            mode={chartData?.mode ?? data.mode}
            comparisonLabel={comparisonLabel}
            comparisonCount={comparisons.data.length}
            onPointClick={handleChartPointClick}
            chartRange={chartRangeEnabled ? chartRange : undefined}
            onChartRangeChange={chartRangeEnabled ? setChartRange : undefined}
            chartLoading={chartLoading}
          />
          <TopProductsByGroup groups={data.topProductGroups} />
          {source === "LOCAL_POS" && data.orders.length > 0 && (
            <RevenueOrderExplorer
              orders={data.orders}
              soldItems={data.soldItems}
            />
          )}
        </>
      )}
    </div>
  );
}
