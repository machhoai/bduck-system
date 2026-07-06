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

import { useMemo, useState } from "react";
import { ShieldOff } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { useInventory } from "../../../hooks/useInventory";
import { useWarehouses, useWarehouseLocations } from "../../../hooks/useWarehouses";
import { useProducts } from "../../../hooks/useProducts";
import {
    computeKPIs,
    computeWarehouseBreakdown,
    computeLowStockProducts,
    computeTopProducts,
    computeProductTypeDistribution,
    computeStockComparison,
} from "../../../utils/inventoryAggregation";

import WarehouseSelector from "../../../components/inventory/WarehouseSelector";
import StatCardGrid from "../../../components/inventory/StatCardGrid";
import WarehouseDetailPopup from "../../../components/inventory/WarehouseDetailPopup";
import StockDistributionChart from "../../../components/inventory/StockDistributionChart";
import StockComparisonChart from "../../../components/inventory/StockComparisonChart";
import StockTrendChart from "../../../components/inventory/StockTrendChart";
import LowStockTable from "../../../components/inventory/LowStockTable";
import TopProductsRanking from "../../../components/inventory/TopProductsRanking";
import InventoryDashboardSkeleton from "../../../components/inventory/InventoryDashboardSkeleton";
import ExpenseDashboardWidgets from "../../../components/features/expenses/ExpenseDashboardWidgets";

export default function DashboardPage() {
    const { t } = useTranslation();
    const d = t.inventoryDashboard;
    const user = useUserStore((s) => s.user);
    const hasPermission = useUserStore((s) => s.hasPermission);
    const displayName = user?.full_name?.split(" ").pop() || "";

    // ── Data hooks (real-time) ──
    const { inventory, loading: invLoading } = useInventory();
    const { warehouses, loading: whLoading } = useWarehouses();
    const { products, loading: prodLoading } = useProducts();
    const isLoading = invLoading || whLoading || prodLoading;

    // ── Warehouse filter ──
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<
        string | undefined
    >(undefined);
    const isAllWarehouses = !selectedWarehouseId;

    // ── Locations for specific warehouse ──
    const { locations } = useWarehouseLocations(selectedWarehouseId);

    // ── Popup state ──
    const [popupMetric, setPopupMetric] = useState<string | null>(null);

    // ── Computed KPIs (memoized) ──
    const kpis = useMemo(
        () => computeKPIs(inventory, warehouses, selectedWarehouseId),
        [inventory, warehouses, selectedWarehouseId],
    );

    const breakdown = useMemo(
        () => computeWarehouseBreakdown(inventory, warehouses),
        [inventory, warehouses],
    );

    const lowStockProducts = useMemo(
        () => computeLowStockProducts(inventory, products, selectedWarehouseId),
        [inventory, products, selectedWarehouseId],
    );

    const topMost = useMemo(
        () => computeTopProducts(inventory, products, selectedWarehouseId, 10, "most"),
        [inventory, products, selectedWarehouseId],
    );

    const topLeast = useMemo(
        () => computeTopProducts(inventory, products, selectedWarehouseId, 10, "least"),
        [inventory, products, selectedWarehouseId],
    );

    const typeDistribution = useMemo(
        () => computeProductTypeDistribution(inventory, products, selectedWarehouseId),
        [inventory, products, selectedWarehouseId],
    );

    const stockComparison = useMemo(
        () => computeStockComparison(inventory, warehouses),
        [inventory, warehouses],
    );

    // ── Permissions ──
    const hasExpenseAccess = hasPermission("expenses.read", selectedWarehouseId) || hasPermission("expenses.consolidated.view");

    // ── Full skeleton while loading ──
    if (isLoading) {
        return <InventoryDashboardSkeleton />;
    }

    // ── No access state ──
    if (warehouses.length === 0 && !isLoading) {
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
        <div className="flex flex-col gap-2">
            {/* ── Header ── */}
            <header
                id="wms-dashboard-header"
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <p className="text-sm font-normal text-[var(--color-text-muted)]">
                        {t.dashboard.welcome}
                        {displayName ? `, ${displayName}` : ""}
                    </p>
                    <h1 className="font-[var(--font-display)] text-lg font-semibold leading-tight tracking-normal text-[var(--color-text-primary)] lg:text-lg">
                        {d.title}
                    </h1>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                        {d.subtitle}
                    </p>
                </div>

                <div id="wms-dashboard-warehouse-filter">
                    <WarehouseSelector
                        warehouses={warehouses}
                        selectedId={selectedWarehouseId}
                        onSelect={setSelectedWarehouseId}
                    />
                </div>
            </header>

            {/* ── Expense Dashboard Widgets ── */}
            {hasExpenseAccess && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <h2 className="font-[var(--font-display)] leading-0 text-xxs font-semibold leading-tight tracking-normal text-[var(--color-text-muted)]">
                            {t.expenses?.title || "Quản lý Chi phí"}
                        </h2>
                    </div>
                    <ExpenseDashboardWidgets warehouseId={selectedWarehouseId || "ALL"} />
                </div>
            )}

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h2 className="font-[var(--font-display)] leading-0 text-xxs font-semibold leading-tight tracking-normal text-[var(--color-text-muted)]">
                        {t.warehouses?.tabWarehouses || "Quản lý Chi phí"}
                    </h2>
                </div>

                {/* ── Stat Cards ── */}
                <div id="wms-dashboard-kpis">
                    <StatCardGrid
                        kpis={kpis}
                        loading={false}
                        isAllWarehouses={isAllWarehouses}
                        locationCount={locations.length}
                        onCardClick={(metric) => setPopupMetric(metric)}
                    />
                </div>

                {/* ── Charts Row ── */}
                <div id="wms-dashboard-charts" className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <StockDistributionChart data={typeDistribution} loading={false} />
                    {isAllWarehouses ? (
                        <StockComparisonChart data={stockComparison} loading={false} />
                    ) : (
                        <StockTrendChart loading={false} />
                    )}
                </div>

                {/* ── Tables Row ── */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div id="wms-dashboard-low-stock">
                        <LowStockTable products={lowStockProducts} loading={false} />
                    </div>
                    <div id="wms-dashboard-top-products">
                        <TopProductsRanking
                            mostStocked={topMost}
                            leastStocked={topLeast}
                            loading={false}
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
