"use client";

/**
 * StockDistributionChart — Donut chart: phân bổ tồn kho theo ProductType
 */

import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
  chartTooltipOptions,
  responsiveChartOptions,
} from "@/components/charts/chartjs";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import type { ProductTypeDistribution } from "@/utils/inventoryAggregation";

interface StockDistributionChartProps {
  data: ProductTypeDistribution[];
  loading: boolean;
}

const COLORS = ["#0066cc", "#257a3e", "#936000", "#6366f1", "#b42318"];

export default function StockDistributionChart({
  data,
  loading,
}: StockDistributionChartProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;
  const typeLabels = d.productTypes as Record<string, string>;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-40" variant="text" />
        <Skeleton className="mx-auto h-[200px] w-[200px]" variant="circle" />
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: typeLabels[item.type] || item.type,
  }));

  const doughnutData: ChartData<"doughnut", number[], string> = {
    labels: chartData.map((item) => item.name),
    datasets: [
      {
        data: chartData.map((item) => item.quantity),
        backgroundColor: chartData.map((_, index) => COLORS[index % COLORS.length]),
        borderWidth: 0,
        borderRadius: 4,
        spacing: 3,
      },
    ],
  };

  const doughnutOptions: ChartOptions<"doughnut"> = {
    ...responsiveChartOptions,
    cutout: "64%",
    plugins: {
      tooltip: {
        ...chartTooltipOptions,
        callbacks: {
          label: (ctx: TooltipItem<"doughnut">) =>
            `${ctx.label}: ${Number(ctx.raw).toLocaleString()} ${d.quantity}`,
        },
      },
      legend: {
        position: "bottom",
        labels: {
          boxHeight: 8,
          boxWidth: 8,
          font: { size: 13 },
          padding: 14,
          pointStyle: "circle",
          usePointStyle: true,
        },
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <h3 className="mb-4 shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">
        {d.stockDistribution}
      </h3>

      {chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t.common.noData}
        </p>
      ) : (
        <div className="relative min-h-[320px] flex-1">
          <ChartCanvas type="doughnut" data={doughnutData} options={doughnutOptions} />
        </div>
      )}
    </div>
  );
}
