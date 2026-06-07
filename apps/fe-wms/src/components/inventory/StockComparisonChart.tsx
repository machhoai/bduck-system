"use client";

/**
 * StockComparisonChart — Bar chart: ATP vs Quarantine vs In-Transit theo kho
 */

import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas from "@/components/charts/ChartCanvas";
import {
  chartAxisColor,
  chartGridColor,
  chartTooltipOptions,
  responsiveChartOptions,
} from "@/components/charts/chartjs";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import type { WarehouseStockComparison } from "@/utils/inventoryAggregation";

interface StockComparisonChartProps {
  data: WarehouseStockComparison[];
  loading: boolean;
}

export default function StockComparisonChart({
  data,
  loading,
}: StockComparisonChartProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-48" variant="text" />
        <Skeleton className="h-[260px] w-full" variant="rect" />
      </div>
    );
  }

  const chartData: ChartData<"bar", number[], string> = {
    labels: data.map((item) => item.warehouseName),
    datasets: [
      {
        label: d.atpQuantity,
        data: data.map((item) => item.atp),
        backgroundColor: "#257a3e",
        borderRadius: 4,
        borderSkipped: "bottom",
        maxBarThickness: 32,
      },
      {
        label: d.quarantineQuantity,
        data: data.map((item) => item.quarantine),
        backgroundColor: "#b42318",
        borderRadius: 4,
        borderSkipped: "bottom",
        maxBarThickness: 32,
      },
      {
        label: d.inTransitQuantity,
        data: data.map((item) => item.inTransit),
        backgroundColor: "#936000",
        borderRadius: 4,
        borderSkipped: "bottom",
        maxBarThickness: 32,
      },
    ],
  };

  const chartOptions: ChartOptions<"bar"> = {
    ...responsiveChartOptions,
    datasets: {
      bar: {
        barPercentage: 0.75,
        categoryPercentage: 0.72,
      },
    },
    plugins: {
      tooltip: chartTooltipOptions,
      legend: {
        position: "bottom",
        labels: {
          boxHeight: 10,
          boxWidth: 10,
          font: { size: 13 },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: chartGridColor },
        ticks: { color: chartAxisColor, font: { size: 12 } },
      },
      y: {
        beginAtZero: true,
        border: { color: chartGridColor },
        grid: { color: chartGridColor },
        ticks: {
          color: chartAxisColor,
          font: { size: 12 },
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
        {d.stockComparison}
      </h3>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t.common.noData}
        </p>
      ) : (
        <div className="relative h-[260px]">
          <ChartCanvas type="bar" data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
