"use client";

/**
 * DashboardPage — Inventory Dashboard tổng hợp
 *
 * ► Thay thế trang chủ cũ (/dashboard)
 * ► Real-time data: onSnapshot cho inventory, products, warehouses
 * ► RBAC: Chỉ hiển thị kho mà user có quyền warehouses.read
 * ► Chọn "Tất cả kho" → click stat card → popup breakdown
 * ► Chọn từng kho → hiển thị chi tiết hơn
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { ShieldOff } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { useWarehouseLocations } from "../../../hooks/useWarehouses";
import { useInventoryDashboardSummary } from "../../../hooks/useInventoryDashboardSummary";

import WarehouseSelector from "../../../components/inventory/WarehouseSelector";
import StatCardGrid from "../../../components/inventory/StatCardGrid";
import WarehouseDetailPopup from "../../../components/inventory/WarehouseDetailPopup";
import LowStockTable from "../../../components/inventory/LowStockTable";
import TopProductsRanking from "../../../components/inventory/TopProductsRanking";
const StockDistributionChart = dynamic(
  () => import("../../../components/inventory/StockDistributionChart"),
);
const StockComparisonChart = dynamic(
  () => import("../../../components/inventory/StockComparisonChart"),
);
const StockTrendChart = dynamic(
  () => import("../../../components/inventory/StockTrendChart"),
);
const DashboardRevenueOverview = dynamic(
  () => import("../../../components/features/revenue/DashboardRevenueOverview"),
);

const EMPTY_KPIS = {
  warehouseCount: 0,
  skuCount: 0,
  totalQuantity: 0,
  atpQuantity: 0,
  quarantineQuantity: 0,
  inTransitQuantity: 0,
  onHoldQuantity: 0,
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;
  const user = useUserStore((state) => state.user);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const displayName = user?.full_name?.split(" ").pop() || "";

  // ── Data hooks (real-time) ──
  // ── Warehouse filter ──
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<
    string | undefined
  >(undefined);
  const isAllWarehouses = !selectedWarehouseId;

  const { data, loading, refreshing, error, retry } =
    useInventoryDashboardSummary(selectedWarehouseId);
  const stores = data?.stores ?? [];

  // ── Locations for specific warehouse ──
  const { locations, loading: locationsLoading } = useWarehouseLocations(
    selectedWarehouseId,
    { enabled: Boolean(selectedWarehouseId) },
  );

  // ── Popup state ──
  const [popupMetric, setPopupMetric] = useState<string | null>(null);

  // ── Computed KPIs (memoized) ──
  const kpis = data?.kpis ?? EMPTY_KPIS;
  const breakdown = data?.breakdown ?? [];
  const lowStockProducts = data?.lowStockProducts ?? [];
  const topMost = data?.topMost ?? [];
  const topLeast = data?.topLeast ?? [];
  const typeDistribution = data?.typeDistribution ?? [];
  const stockComparison = data?.stockComparison ?? [];
  const initialLoading = loading && !data;

  // ── Permissions ──
  const hasRevenueAccess = hasPermission("revenue.read");
  // ── Full skeleton while loading ──
  // ── No access state ──
  if (data && stores.length === 0 && !loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]">
          <ShieldOff
            size={28}
            strokeWidth={1.5}
            className="text-[var(--color-text-muted)]"
          />
        </div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {d.noAccess}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {d.noAccessDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 pb-3">
      <div className="absolute -top-12 -left-2 -right-2 lg:-left-4 lg:-right-2 h-60 rounded-b-3xl bg-[var(--color-brand-primary)] pointer-events-none z-0"></div>
      {/* ── Header ── */}
      <header
        id="wms-dashboard-header"
        className="relative z-10 flex justify-between gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[var(--font-display)] text-lg font-bold leading-tight tracking-tight text-white">
              {t.dashboard.welcome}, {displayName}
            </h1>
          </div>
          <p className="text-xs text-white/90">{d.title}</p>
        </div>

        <div id="wms-dashboard-warehouse-filter" className="shrink-0">
          <WarehouseSelector
            warehouses={stores}
            selectedId={selectedWarehouseId}
            onSelect={setSelectedWarehouseId}
          />
        </div>
      </header>

      {error && (
        <div className="relative z-10 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error.message}</span>
          <button
            type="button"
            onClick={() => void retry()}
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {refreshing && (
        <p className="relative z-10 text-right text-[10px] text-white/80">
          {t.common.loading}
        </p>
      )}

      {hasRevenueAccess && data && stores.length > 0 && (
        <div className="flex flex-col gap-3">
          <DashboardRevenueOverview
            warehouseId={selectedWarehouseId || stores[0]?.id}
          />
        </div>
      )}

      {/* ── Expense Dashboard Widgets ── */}
      {/* {hasExpenseAccess && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-1.5">
                        <h2 className="font-[var(--font-display)] text-base font-semibold leading-tight text-[var(--color-text-primary)]">
                            {t.expenses?.title || "Quản lý Chi phí"}
                        </h2>
                    </div>
                    <ExpenseDashboardWidgets
                        warehouseId={selectedWarehouseId || "ALL"}
                    />
                </div>
            )} */}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1.5">
          <h2 className="font-[var(--font-display)] text-base font-semibold leading-tight text-[var(--color-text-primary)]">
            {d.inventorySectionTitle}
          </h2>
        </div>

        {/* ── Stat Cards ── */}
        <div id="wms-dashboard-kpis">
          <StatCardGrid
            kpis={kpis}
            loading={initialLoading}
            isAllWarehouses={isAllWarehouses}
            locationCount={locationsLoading ? undefined : locations.length}
            onCardClick={(metric) => setPopupMetric(metric)}
          />
        </div>

        {/* ── Charts Row ── */}
        <div
          id="wms-dashboard-charts"
          className="grid grid-cols-1 gap-3 lg:grid-cols-2"
        >
          {data ? (
            <>
              <StockDistributionChart data={typeDistribution} loading={false} />
              {isAllWarehouses ? (
                <StockComparisonChart data={stockComparison} loading={false} />
              ) : (
                <StockTrendChart loading={false} />
              )}
            </>
          ) : initialLoading ? (
            <>
              <div className="h-[320px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-skeleton-base)]" />
              <div className="h-[320px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-skeleton-base)]" />
            </>
          ) : null}
        </div>

        {/* ── Tables Row ── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div id="wms-dashboard-low-stock">
            <LowStockTable
              products={lowStockProducts}
              loading={initialLoading}
            />
          </div>
          <div id="wms-dashboard-top-products">
            <TopProductsRanking
              mostStocked={topMost}
              leastStocked={topLeast}
              loading={initialLoading}
            />
          </div>
        </div>

        {/* ── Warehouse Detail Popup ── */}
        <WarehouseDetailPopup
          isOpen={popupMetric !== null && isAllWarehouses}
          onClose={() => setPopupMetric(null)}
          metric={popupMetric || "totalQuantity"}
          breakdown={breakdown}
        />
      </div>
    </div>
  );
}
