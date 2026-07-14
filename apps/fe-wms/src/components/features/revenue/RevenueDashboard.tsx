"use client";

import {
    AlertTriangle,
    BarChart3,
    Coins,
    Gamepad2,
    PackageSearch,
    ReceiptText,
    TrendingUp,
    type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
    buildRevenueComparisonFilters,
    getDefaultRevenueComparison,
    getDefaultRevenueFilter,
    getRevenueComparisonLabel,
    getRevenueComparisonLabels,
    useRevenueDashboard,
    useRevenueDashboardComparisons,
    type DeviceConsumptionItem,
    type RevenueComparisonSelection,
    type RevenueDashboardFilter,
    type RevenueOrderItem,
    type SoldOrderGoodsItem,
} from "@/hooks/useRevenueDashboard";
import { useStores } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import RevenueCharts from "./RevenueCharts";
import RevenueDateFilter from "./RevenueDateFilter";
import RevenueDashboardSkeleton from "./RevenueDashboardSkeleton";
import DeviceConsumptionTable from "./DeviceConsumptionTable";
import OnlineRevenueSection from "./OnlineRevenueSection";
import RevenueOrderTabs from "./RevenueOrderTabs";
import RevenueStats from "./RevenueStats";
import TopProductsByGroup from "./TopProductsByGroup";
import { formatCurrency, formatNumber } from "./revenueDashboardUtils";

type RevenueDashboardTab = "revenue" | "devices" | "orders";

export default function RevenueDashboard() {
    const { t } = useTranslation();
    const d = t.revenue;
    const [activeTab, setActiveTab] = useState<RevenueDashboardTab>("revenue");
    const [filter, setFilter] = useState<RevenueDashboardFilter>(() => getDefaultRevenueFilter());
    const { stores, loading: storesLoading } = useStores();
    const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
    const activeWarehouseId = stores.some((store) => store.id === selectedWarehouseId)
        ? selectedWarehouseId
        : stores[0]?.id || "";
    const [comparison, setComparison] = useState<RevenueComparisonSelection>(() =>
        getDefaultRevenueComparison(getDefaultRevenueFilter()),
    );
    const { data, loading, syncing, error } = useRevenueDashboard(filter, {
        warehouseId: activeWarehouseId,
        enabled: Boolean(activeWarehouseId),
    });
    const comparisonFilters = useMemo(() => buildRevenueComparisonFilters(filter, comparison), [comparison, filter]);
    const {
        data: comparisonData,
        syncing: comparisonSyncing,
        error: comparisonError,
    } = useRevenueDashboardComparisons(
        activeWarehouseId ? comparisonFilters : [],
        activeWarehouseId,
    );
    const comparisonLabels = useMemo(() => getRevenueComparisonLabels(comparisonFilters), [comparisonFilters]);
    const comparisonLabel = comparisonLabels.join(", ");

    const handleChartPointClick = (key: string) => {
        if (/^\d{4}-\d{2}$/.test(key)) {
            setFilter((current) => ({ ...current, mode: "month", month: key }));
            return;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            setFilter((current) => ({ ...current, mode: "date", date: key }));
        }
    };

    if (!storesLoading && stores.length === 0) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 text-center">
                <PackageSearch
                    size={36}
                    className="mb-3 text-[var(--color-text-muted)]"
                />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {d.filters.noWarehouse}
                </p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{d.filters.warehouse}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                            {data?.warehouseName || stores.find((item) => item.id === activeWarehouseId)?.name || d.filters.selectWarehouse}
                        </p>
                    </div>
                    <select
                        aria-label={d.filters.warehouse}
                        value={activeWarehouseId}
                        onChange={(event) => setSelectedWarehouseId(event.target.value)}
                        disabled={storesLoading || stores.length === 0}
                        className="h-10 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-primary)] sm:w-80"
                    >
                        {stores.length === 0 && <option value="">{d.filters.noWarehouse}</option>}
                        {stores.map((store) => (
                            <option key={store.id} value={store.id}>
                                {store.name}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            <RevenueDateFilter
                filter={filter}
                comparison={comparison}
                comparisonLabel={comparisonLabel}
                onChange={setFilter}
                onComparisonChange={setComparison}
                generatedAt={data?.generatedAt}
                syncing={syncing || comparisonSyncing}
            />

            {error && (
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {comparisonError && (
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{comparisonError}</span>
                </div>
            )}

            {loading && <RevenueDashboardSkeleton />}

            {!loading && data && (
                <>
                    <RevenueWorkspaceTabs
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        revenueValue={formatCurrency(data.stats.totalRevenue.value)}
                        deviceValue={formatNumber(data.stats.deviceConsumption.value)}
                        orderValue={formatNumber(data.stats.totalOrders.value)}
                    />

                    {activeTab === "revenue" && (
                        <div className="flex flex-col gap-4">
                            <RevenueStats
                                data={data}
                                comparisonData={comparisonData.length === 1 ? comparisonData[0] : null}
                                comparisonLabel={comparisonData.length === 1 ? comparisonLabel : ""}
                            />
                            <RevenueCharts
                                currentPeriod={{
                                    key: data.cacheKey,
                                    label: getRevenueComparisonLabel(filter) || data.range.label,
                                    revenue: data.stats.totalRevenue.value,
                                    orderCount: data.stats.totalOrders.value,
                                    memberCardAmount: data.stats.memberCardSales.value,
                                }}
                                comparisonPeriods={comparisonData.map((item, index) => ({
                                    key: item.cacheKey,
                                    label: comparisonLabels[index] ?? item.range.label,
                                    revenue: item.stats.totalRevenue.value,
                                    orderCount: item.stats.totalOrders.value,
                                    memberCardAmount: item.stats.memberCardSales.value,
                                }))}
                                points={data.charts.points}
                                comparisonPoints={comparisonData[0]?.charts.points}
                                paymentMethods={data.charts.paymentMethods}
                                mode={data.mode}
                                comparisonLabel={comparisonLabel}
                                comparisonCount={comparisonData.length}
                                onPointClick={handleChartPointClick}
                            />
                            <OnlineRevenueSection filter={filter} />
                            <TopProductsByGroup groups={data.topProductGroups} />
                        </div>
                    )}

                    {activeTab === "devices" && (
                        <div className="flex flex-col gap-4">
                            <DeviceTabSummary rows={data.deviceConsumptions} />
                            <DeviceConsumptionTable rows={data.deviceConsumptions} />
                        </div>
                    )}

                    {activeTab === "orders" && (
                        <div className="flex flex-col gap-4">
                            <OrderTabSummary
                                orders={data.orders}
                                soldItems={data.soldItems}
                            />
                            <RevenueOrderTabs orders={data.orders} soldItems={data.soldItems} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function RevenueWorkspaceTabs({
    activeTab,
    onChange,
    revenueValue,
    deviceValue,
    orderValue,
}: {
    activeTab: RevenueDashboardTab;
    onChange: (tab: RevenueDashboardTab) => void;
    revenueValue: string;
    deviceValue: string;
    orderValue: string;
}) {
    const { t } = useTranslation();
    const tabs = t.revenue.tabs;
    const items: Array<{
        key: RevenueDashboardTab;
        icon: LucideIcon;
        label: string;
        description: string;
        value: string;
        accent: string;
        mutedAccent: string;
    }> = [
            {
                key: "revenue",
                icon: BarChart3,
                label: tabs.revenue.label,
                description: tabs.revenue.description,
                value: revenueValue,
                accent: "text-[var(--color-brand-primary)]",
                mutedAccent: "bg-[var(--color-brand-primary)]/10",
            },
            {
                key: "devices",
                icon: Gamepad2,
                label: tabs.devices.label,
                description: tabs.devices.description,
                value: deviceValue,
                accent: "text-emerald-600",
                mutedAccent: "bg-emerald-500/10",
            },
            {
                key: "orders",
                icon: ReceiptText,
                label: tabs.orders.label,
                description: tabs.orders.description,
                value: orderValue,
                accent: "text-amber-600",
                mutedAccent: "bg-amber-500/10",
            },
        ];

    return (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                {items.map((item) => (
                    <WorkspaceTabButton
                        key={item.key}
                        item={item}
                        active={activeTab === item.key}
                        onClick={() => onChange(item.key)}
                    />
                ))}
            </div>
        </section>
    );
}

function WorkspaceTabButton({
    item,
    active,
    onClick,
}: {
    item: {
        icon: LucideIcon;
        label: string;
        description: string;
        value: string;
        accent: string;
        mutedAccent: string;
    };
    active: boolean;
    onClick: () => void;
}) {
    const Icon = item.icon;
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-2 text-left transition-all duration-200 ${active
                ? "border-[var(--color-brand-primary)] bg-white shadow-sm ring-2 ring-[var(--color-brand-primary)]/10"
                : "border-transparent bg-[var(--color-surface-card)] hover:border-[var(--color-border-subtle)] hover:bg-white"
                }`}
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${active ? item.mutedAccent : "bg-white"} ${item.accent} ring-1 ring-black/[0.04]`}>
                    <Icon size={20} strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {item.label}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">
                        {item.description}
                    </span>
                </span>
            </span>
            <span className={`max-w-[128px] shrink-0 truncate rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-black tabular-nums ${active ? "bg-[var(--color-brand-primary)] text-white" : "bg-white text-[var(--color-text-primary)]"}`}>
                {item.value}
            </span>
        </button>
    );
}

function DeviceTabSummary({ rows }: { rows: DeviceConsumptionItem[] }) {
    const { t } = useTranslation();
    const d = t.revenue;
    const summary = getDeviceSummary(rows);

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile icon={Coins} label={d.stats.deviceConsumption} value={formatNumber(summary.totalConsum)} tone="blue" />
            <SummaryTile icon={TrendingUp} label={d.deviceConsumption.columns.electronic} value={formatNumber(summary.totalElectronic)} tone="emerald" />
            <SummaryTile icon={Gamepad2} label={d.deviceConsumption.columns.physical} value={formatNumber(summary.totalPhysical)} tone="amber" />
            <SummaryTile icon={PackageSearch} label={d.deviceConsumption.columns.give} value={formatNumber(summary.totalGive)} tone="cyan" />
        </div>
    );
}

function OrderTabSummary({
    orders,
    soldItems,
}: {
    orders: RevenueOrderItem[];
    soldItems: SoldOrderGoodsItem[];
}) {
    const { t } = useTranslation();
    const d = t.revenue;
    const totalRevenue = orders.reduce((sum, order) => sum + order.realMoney, 0);
    const totalQty = orders.reduce((sum, order) => sum + order.totalQty, 0);
    const averageOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile icon={ReceiptText} label={d.stats.totalOrders} value={formatNumber(orders.length)} tone="blue" />
            <SummaryTile icon={BarChart3} label={d.stats.totalRevenue} value={formatCurrency(totalRevenue)} tone="emerald" />
            <SummaryTile icon={PackageSearch} label={d.orders.tabs.items} value={formatNumber(soldItems.length)} tone="amber" />
            <SummaryTile icon={TrendingUp} label={d.stats.averageOrderValue} value={formatCurrency(averageOrder)} hint={`${formatNumber(totalQty)} ${d.orders.columns.qty}`} tone="cyan" />
        </div>
    );
}

function SummaryTile({
    icon: Icon,
    label,
    value,
    hint,
    tone,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    hint?: string;
    tone: "blue" | "emerald" | "amber" | "cyan";
}) {
    const toneClass = {
        blue: "bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]",
        emerald: "bg-emerald-500/10 text-emerald-600",
        amber: "bg-amber-500/10 text-amber-600",
        cyan: "bg-cyan-500/10 text-cyan-600",
    }[tone];

    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--color-text-muted)]">{label}</p>
                    <p className="mt-2 truncate text-xl font-black tabular-nums text-[var(--color-text-primary)]">{value}</p>
                    {hint && <p className="mt-1 truncate text-xxs font-semibold text-[var(--color-text-muted)]">{hint}</p>}
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${toneClass}`}>
                    <Icon size={17} strokeWidth={2} />
                </span>
            </div>
        </div>
    );
}

function getDeviceSummary(rows: DeviceConsumptionItem[]) {
    return {
        rows,
        totalElectronic: rows.reduce((sum, row) => sum + (row.electronicCoinConsum || 0), 0),
        totalPhysical: rows.reduce((sum, row) => sum + (row.physicalCoinConsum || 0), 0),
        totalConsum: rows.reduce((sum, row) => sum + (row.totalConsum || 0), 0),
        totalGive: rows.reduce((sum, row) => sum + (row.coinGiveQuantity || 0), 0),
    };
}
