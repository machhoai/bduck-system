"use client";

import type { ChartData, ChartOptions } from "chart.js";
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

export default function RevenueMemberCardChart({
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
    (point) => typeof point.comparisonMemberCardAmount === "number",
  );
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: points.map((point) => point.label),
      datasets: [
        {
          label:
            variant === "period"
              ? copy.charts.selectedMemberCard
              : copy.charts.currentMemberCard,
          data: points.map((point) => point.memberCardAmount),
          backgroundColor: points.map((point) =>
            point.highlighted ? chartColors.amber : "rgba(22,163,74,0.6)",
          ),
          borderRadius: 6,
        },
        ...(hasComparison
          ? [
              {
                label: withRevenuePeriodLabel(
                  copy.charts.comparisonMemberCard,
                  comparisonLabel,
                ),
                data: points.map(
                  (point) => point.comparisonMemberCardAmount ?? 0,
                ),
                backgroundColor: "rgba(100,116,139,0.24)",
                borderRadius: 6,
              },
            ]
          : []),
      ],
    }),
    [comparisonLabel, copy, hasComparison, points, variant],
  );

  const options = useMemo<ChartOptions<"bar">>(
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
                  copy.charts.comparisonMemberCard,
                ),
              ),
            label: (context) =>
              `${context.dataset.label}: ${formatCurrency(Number(context.raw))}`,
          },
        },
        legend: {
          display: hasComparison,
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
    [comparisonLabel, copy, hasComparison, points],
  );

  return (
    <RevenueChartShell title={title} subtitle={copy.charts.memberCardSubtitle}>
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
