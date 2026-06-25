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
import DeviceConsumptionTable from "./DeviceConsumptionTable";
import OnlineRevenueSection from "./OnlineRevenueSection";
import RevenueOrderTabs from "./RevenueOrderTabs";
import RevenueStats from "./RevenueStats";
import TopProductsByGroup from "./TopProductsByGroup";

export default function RevenueDashboard() {
    const { t } = useTranslation();
    const d = t.revenue;
    const [filter, setFilter] = useState<RevenueDashboardFilter>(() => getDefaultRevenueFilter());
    const { data, loading, syncing, error } = useRevenueDashboard(filter);

    const handleChartPointClick = (key: string) => {
        if (/^\d{4}-\d{2}$/.test(key)) {
            setFilter((current) => ({ ...current, mode: "month", month: key }));
            return;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            setFilter((current) => ({ ...current, mode: "date", date: key }));
        }
    };

    return (
        <div className="flex w-full flex-col gap-4">
            <RevenueDateFilter filter={filter} onChange={setFilter} generatedAt={data?.generatedAt} syncing={syncing} />

            {error && (
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {loading && <RevenueDashboardSkeleton />}

            {!loading && data && (
                <>
                    <RevenueStats data={data} />
                    <RevenueCharts
                        points={data.charts.points}
                        paymentMethods={data.charts.paymentMethods}
                        onPointClick={handleChartPointClick}
                    />
                    <OnlineRevenueSection filter={filter} />
                    <TopProductsByGroup groups={data.topProductGroups} />
                    <DeviceConsumptionTable rows={data.deviceConsumptions} />
                    <RevenueOrderTabs orders={data.orders} soldItems={data.soldItems} />
                </>
            )}
        </div>
    );
}
