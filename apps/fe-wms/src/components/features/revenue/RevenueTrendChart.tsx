"use client";

import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { useMemo } from "react";

import ChartCanvas from "@/components/charts/ChartCanvas";
import {
  chartAxisColor,
  chartGridColor,
  chartTooltipOptions,
  responsiveChartOptions,
} from "@/components/charts/chartjs";
import { useTranslation } from "@/lib/i18n";

import {
  getRevenueTooltipTitle,
  isComparisonTooltip,
  RevenueChartShell,
  RevenueEmptyChart,
  withRevenuePeriodLabel,
} from "./RevenueChartPrimitives";
import {
  chartColors,
  formatAxisValue,
  formatCurrency,
  type ComparableRevenueChartPoint,
} from "./revenueDashboardUtils";

type MixedChartType = "bar" | "line";

export default function RevenueTrendChart({
  points,
  title,
  comparisonLabel,
  variant,
  onPointClick,
}: {
  points: ComparableRevenueChartPoint[];
  title: string;
  comparisonLabel?: string;
  variant: "timeline" | "period";
  onPointClick?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const copy = t.revenue;
  const hasComparison = points.some(
    (point) => typeof point.comparisonRevenue === "number",
  );
  const data = useMemo<ChartData<MixedChartType, number[], string>>(
    () => ({
      labels: points.map((point) => point.label),
      datasets: [
        ...(hasComparison
          ? [
              {
                type: "bar" as const,
                label: withRevenuePeriodLabel(
                  copy.charts.comparisonRevenue,
                  comparisonLabel,
                ),
                data: points.map((point) => point.comparisonRevenue ?? 0),
                backgroundColor: "rgba(100,116,139,0.24)",
                borderRadius: 6,
                borderSkipped: "bottom" as const,
                order: 3,
              },
            ]
          : []),
        {
          type: "bar",
          label:
            variant === "period"
              ? copy.charts.selectedRevenue
              : copy.charts.currentRevenue,
          data: points.map((point) => point.revenue),
          backgroundColor: points.map((point) =>
            point.highlighted ? chartColors.amber : "rgba(0,102,204,0.6)",
          ),
          borderRadius: 6,
          borderSkipped: "bottom",
          order: 2,
        },
        ...(variant === "timeline"
          ? [
              {
                type: "line" as const,
                label: copy.charts.currentTrend,
                data: points.map((point) => point.revenue),
                borderColor: chartColors.green,
                backgroundColor: "rgba(22,163,74,0.06)",
                pointBackgroundColor: points.map((point) =>
                  point.highlighted ? chartColors.amber : chartColors.green,
                ),
                pointRadius: points.map((point) => (point.highlighted ? 5 : 3)),
                pointHoverRadius: 7,
                fill: true,
                tension: 0.35,
                order: 1,
              },
            ]
          : []),
        ...(hasComparison
          ? [
              {
                type: "line" as const,
                label: withRevenuePeriodLabel(
                  copy.charts.comparisonTrend,
                  comparisonLabel,
                ),
                data: points.map((point) => point.comparisonRevenue ?? 0),
                borderColor: chartColors.slate,
                backgroundColor: "rgba(100,116,139,0.04)",
                borderDash: [5, 5],
                pointRadius: 2,
                pointHoverRadius: 5,
                fill: false,
                tension: 0.35,
                order: 0,
              },
            ]
          : []),
      ],
    }),
    [comparisonLabel, copy, hasComparison, points, variant],
  );

  const options = useMemo<ChartOptions<MixedChartType>>(
    () => ({
      ...responsiveChartOptions,
      plugins: {
        tooltip: {
          ...chartTooltipOptions,
          callbacks: {
            title: (items) =>
              getRevenueTooltipTitle(
                points[items[0]?.dataIndex],
                isComparisonTooltip(
                  items[0]?.dataset.label,
                  comparisonLabel,
                  copy.charts.comparisonTrend,
                ),
              ),
            label: (context: TooltipItem<MixedChartType>) =>
              `${context.dataset.label}: ${formatCurrency(Number(context.raw))}`,
          },
        },
        legend: {
          labels: { color: chartAxisColor, boxWidth: 10, font: { size: 11 } },
        },
      },
      scales: {
        x: {
          ticks: { color: chartAxisColor, font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: chartAxisColor,
            font: { size: 10 },
            callback: (value) => formatAxisValue(Number(value)),
          },
          grid: { color: chartGridColor },
        },
      },
    }),
    [comparisonLabel, copy, points],
  );

  return (
    <RevenueChartShell title={title} subtitle={copy.charts.revenueSubtitle}>
      {points.length > 0 ? (
        <ChartCanvas
          type="bar"
          data={data}
          options={options}
          onElementClick={(index) => onPointClick?.(points[index]?.key)}
        />
      ) : (
        <RevenueEmptyChart />
      )}
    </RevenueChartShell>
  );
}
