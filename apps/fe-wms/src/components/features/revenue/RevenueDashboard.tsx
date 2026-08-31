"use client";

import type {
  RevenueDashboardData,
  RevenueDataSource,
} from "@bduck/shared-types";
import { BarChart3, Building2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useExternalStoreBindings } from "@/hooks/useExternalStoreBindings";
import { useOpenApiRevenueWarehouses } from "@/hooks/useOpenApiRevenueWarehouses";
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
import { useStores } from "@/hooks/useWarehouses";
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
import TopProductsByGroup from "./TopProductsByGroup";

export default function RevenueDashboard() {
  const { t } = useTranslation();
  const copy = t.revenue;
  const [source, setSource] = useState<RevenueDataSource>("OPEN_API");
  const [filter, setFilter] = useState<RevenueDashboardFilter>(() =>
    getDefaultRevenueFilter(),
  );
  const [comparison, setComparison] = useState<RevenueComparisonSelection>(() =>
    getDefaultRevenueComparison(getDefaultRevenueFilter()),
  );
  const [selectedWarehouses, setSelectedWarehouses] = useState<
    Partial<Record<RevenueDataSource, string>>
  >({});
  const { stores, loading: storesLoading } = useStores();
  const {
    bindings,
    loading: bindingsLoading,
    error: bindingsError,
  } = useExternalStoreBindings();
  const {
    warehouseIds: openApiWarehouseIds,
    loading: openApiWarehousesLoading,
    error: openApiWarehousesError,
  } = useOpenApiRevenueWarehouses();

  const openApiStores = useMemo(() => {
    if (bindingsError || openApiWarehousesError) return [];
    const configuredIds = new Set(openApiWarehouseIds);
    return stores.filter((store) => {
      const binding = bindings.find(
        (item) =>
          item.source_system === "JOYWORLD_LEGACY" &&
          item.member_warehouse_ids.includes(store.id),
      );
      const canonicalId = binding?.canonical_warehouse_id ?? store.id;
      return canonicalId === store.id && configuredIds.has(canonicalId);
    });
  }, [
    bindings,
    bindingsError,
    openApiWarehouseIds,
    openApiWarehousesError,
    stores,
  ]);
  const sourceStores = source === "OPEN_API" ? openApiStores : stores;
  const selectedWarehouseId = selectedWarehouses[source] ?? "";
  const activeWarehouseId = sourceStores.some(
    (store) => store.id === selectedWarehouseId,
  )
    ? selectedWarehouseId
    : (sourceStores[0]?.id ?? "");
  const activeStore = sourceStores.find(
    (store) => store.id === activeWarehouseId,
  );

  const openApiDashboard = useRevenueDashboard(filter, {
    source: "OPEN_API",
    warehouseId: activeWarehouseId,
    enabled: source === "OPEN_API" && Boolean(activeWarehouseId),
  });
  const localDashboard = usePosRevenueStats(
    source === "LOCAL_POS" && activeWarehouseId ? [activeWarehouseId] : [],
    filter,
  );
  const comparisonFilters = useMemo(
    () => buildRevenueComparisonFilters(filter, comparison),
    [comparison, filter],
  );
  const comparisons = useRevenueDashboardComparisons(
    activeWarehouseId ? comparisonFilters : [],
    activeWarehouseId,
    source,
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
            warehouseName: rawData.warehouseName || activeStore?.name || "",
          }
        : null,
    [activeStore?.name, rawData],
  );
  const loading =
    storesLoading ||
    (source === "OPEN_API"
      ? bindingsLoading || openApiWarehousesLoading || openApiDashboard.loading
      : localDashboard.loading);
  const syncing = openApiDashboard.syncing || comparisons.syncing;
  const error =
    source === "OPEN_API"
      ? openApiWarehousesError || openApiDashboard.error
      : localDashboard.error;

  useRevenueExportRegistration({
    source,
    warehouseId: activeWarehouseId,
    warehouseName: activeStore?.name,
    rangeLabel: getRevenueComparisonLabel(filter) || data?.range.label,
    filter,
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

        <label className="flex min-h-14 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 shadow-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)]">
            <Building2 size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {copy.filters.warehouse}
            </span>
            <select
              aria-label={copy.filters.warehouse}
              value={activeWarehouseId}
              disabled={loading || sourceStores.length === 0}
              onChange={(event) =>
                setSelectedWarehouses((current) => ({
                  ...current,
                  [source]: event.target.value,
                }))
              }
              className="mt-0.5 h-6 w-full min-w-0 appearance-none bg-transparent text-sm font-semibold text-[var(--color-text-primary)] outline-none disabled:opacity-60"
            >
              {sourceStores.length === 0 && (
                <option value="">{copy.filters.noWarehouse}</option>
              )}
              {sourceStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {source === "OPEN_API"
                    ? bindings.find(
                        (binding) =>
                          binding.canonical_warehouse_id === store.id,
                      )?.display_name || store.name
                    : store.name}
                </option>
              ))}
            </select>
          </span>
        </label>
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
            points={data.charts.points}
            comparisonPoints={comparisons.data[0]?.charts.points}
            paymentMethods={data.charts.paymentMethods}
            mode={data.mode}
            comparisonLabel={comparisonLabel}
            comparisonCount={comparisons.data.length}
            onPointClick={handleChartPointClick}
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
