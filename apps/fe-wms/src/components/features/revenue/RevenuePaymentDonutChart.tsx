"use client";

import type { PaymentMethodMetric } from "@bduck/shared-types";
import type { ChartData, ChartOptions } from "chart.js";
import { useMemo } from "react";

import ChartCanvas from "@/components/charts/ChartCanvas";
import {
  chartTooltipOptions,
  responsiveChartOptions,
} from "@/components/charts/chartjs";
import { useTranslation } from "@/lib/i18n";

import { RevenueChartShell, RevenueEmptyChart } from "./RevenueChartPrimitives";
import { donutColors, formatCurrency } from "./revenueDashboardUtils";

const colorClasses = [
  "bg-blue-600",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
] as const;

export default function RevenuePaymentDonutChart({
  methods,
  title,
}: {
  methods: PaymentMethodMetric[];
  title: string;
}) {
  const { t } = useTranslation();
  const copy = t.revenue;
  const labels = useMemo(
    () =>
      methods.map((method) =>
        method.method in copy.paymentMethodLabels
          ? copy.paymentMethodLabels[
              method.method as keyof typeof copy.paymentMethodLabels
            ]
          : method.method,
      ),
    [copy, methods],
  );
  const data = useMemo<ChartData<"doughnut", number[], string>>(
    () => ({
      labels,
      datasets: [
        {
          data: methods.map((method) => method.amount),
          backgroundColor: methods.map(
            (_, index) => donutColors[index % donutColors.length],
          ),
          borderColor: "#fff",
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    }),
    [labels, methods],
  );

  const options = useMemo<ChartOptions<"doughnut">>(
    () => ({
      ...responsiveChartOptions,
      cutout: "68%",
      plugins: {
        tooltip: {
          ...chartTooltipOptions,
          callbacks: {
            label: (context) =>
              `${context.label}: ${formatCurrency(Number(context.raw))}`,
          },
        },
        legend: { display: false },
      },
    }),
    [],
  );

  return (
    <RevenueChartShell title={title} subtitle={copy.charts.paymentSubtitle}>
      <div className="grid h-full grid-cols-1 gap-3">
        <div className="relative mx-auto flex h-[160px] w-full items-center justify-center sm:h-[210px]">
          {methods.length > 0 ? (
            <ChartCanvas type="doughnut" data={data} options={options} />
          ) : (
            <RevenueEmptyChart />
          )}
        </div>
        <div className="flex flex-col gap-1">
          {methods.slice(0, 4).map((method, index) => (
            <div
              key={method.method}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] px-1 py-1 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2 text-[var(--color-text-muted)]">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${colorClasses[index % colorClasses.length]}`}
                />
                <span className="truncate">
                  {labels[index] ?? method.method}
                </span>
              </span>
              <span className="font-bold tabular-nums text-[var(--color-text-primary)]">
                {method.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </RevenueChartShell>
  );
}
