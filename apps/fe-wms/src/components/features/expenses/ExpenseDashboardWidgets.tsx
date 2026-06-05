"use client";

import { useTranslation } from "@/lib/i18n";
import { useExpenseDashboardMetrics, type DashboardKPI } from "@/hooks/useExpenseDashboardMetrics";
import { useRevenueSync } from "@/hooks/useRevenueSync";
import { KPICard, ExpenseTrendChart, AllocationDonutChart } from "./ExpenseDashboard";
export default function ExpenseDashboardWidgets({
    warehouseId,
}: {
    warehouseId: string;
}) {
    const { t } = useTranslation();
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { metrics, loading, error } = useExpenseDashboardMetrics(warehouseId, period);
    const { revenue: revenueSync } = useRevenueSync(period);

    // Override KPIs with JoyWorld real-time revenue when available
    const joyRevenue = revenueSync?.total_revenue ?? 0;
    const hasJoyRevenue = joyRevenue > 0;

    const EMPTY_KPI: DashboardKPI = { value: 0, prevValue: 0, trend: 0 };

    const grossRevenueKPI: DashboardKPI = hasJoyRevenue
        ? { value: joyRevenue, prevValue: metrics.grossRevenue?.prevValue ?? 0, trend: metrics.grossRevenue?.prevValue ? ((joyRevenue - (metrics.grossRevenue?.prevValue ?? 0)) / (metrics.grossRevenue?.prevValue || 1)) * 100 : 0 }
        : (metrics.grossRevenue ?? EMPTY_KPI);

    const totalExpensesKPI = metrics.totalExpenses ?? EMPTY_KPI;

    const netProfitValue = hasJoyRevenue
        ? joyRevenue - totalExpensesKPI.value
        : (metrics.netProfit?.value ?? 0);
    const netProfitKPI: DashboardKPI = hasJoyRevenue
        ? { value: netProfitValue, prevValue: metrics.netProfit?.prevValue ?? 0, trend: metrics.netProfit?.prevValue ? ((netProfitValue - (metrics.netProfit?.prevValue ?? 0)) / Math.abs(metrics.netProfit?.prevValue || 1)) * 100 : 0 }
        : (metrics.netProfit ?? EMPTY_KPI);

    const profitMarginValue = hasJoyRevenue && joyRevenue > 0
        ? (netProfitValue / joyRevenue) * 100
        : (metrics.profitMargin?.value ?? 0);
    const profitMarginKPI: DashboardKPI = hasJoyRevenue
        ? { value: profitMarginValue, prevValue: metrics.profitMargin?.prevValue ?? 0, trend: metrics.profitMargin?.prevValue ? profitMarginValue - (metrics.profitMargin?.prevValue ?? 0) : 0 }
        : (metrics.profitMargin ?? EMPTY_KPI);

    if (error) return null; // Silently hide on error in main dashboard
    if (loading) return (
        <div className="flex w-full flex-col gap-4 animate-pulse">
            <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[104px] w-full rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] border border-[var(--color-border-soft)] p-5">
                         <div className="h-8 w-10 bg-slate-100 rounded mb-3"></div>
                         <div className="h-6 w-24 bg-slate-100 rounded"></div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                 <div className="h-[300px] w-full rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] border border-[var(--color-border-soft)]"></div>
                 <div className="h-[300px] w-full rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] border border-[var(--color-border-soft)]"></div>
            </div>
        </div>
    );

    return (
        <div className="flex w-full flex-col gap-2">
            <div className="grid w-full grid-cols-2 gap-2 xl:grid-cols-4">
                <KPICard title={t.expenses.dashboard.grossRevenue} kpi={grossRevenueKPI} suffix="đ" index={0} />
                <KPICard title={t.expenses.dashboard.totalExpenses} kpi={totalExpensesKPI} suffix="đ" index={1} />
                <KPICard title={t.expenses.dashboard.netProfit} kpi={netProfitKPI} suffix="đ" index={2} />
                <KPICard title={t.expenses.dashboard.profitMargin} kpi={profitMarginKPI} suffix="%" index={3} />
            </div>

            <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                    <ExpenseTrendChart
                        data={hasJoyRevenue
                            ? (metrics.trendData ?? []).map((d) => {
                                const monthNum = period.split("-")[1];
                                const label = `T${parseInt(monthNum, 10)}`;
                                if (d.month === label) {
                                    return { ...d, revenue: joyRevenue };
                                }
                                return d;
                            })
                            : (metrics.trendData ?? [])
                        }
                        title={t.expenses.dashboard.expenseTrend}
                        subtitle={t.expenses.dashboard.expenseTrendDesc}
                        t={t}
                    />
                </div>
                <div>
                    <AllocationDonutChart
                        data={metrics.costCenterBreakdown ?? []}
                        title={t.expenses.dashboard.expenseBreakdown}
                        costCenterLabels={t.expenses.costCenter}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
}
