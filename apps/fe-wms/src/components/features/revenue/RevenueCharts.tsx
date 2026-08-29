"use client";

import type {
  PaymentMethodMetric,
  RevenueChartPoint,
  RevenueDateMode,
} from "@bduck/shared-types";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";

import { RevenueChartSummary } from "./RevenueChartPrimitives";
import {
  prepareComparableRevenuePoints,
  type ComparableRevenueChartPoint,
} from "./revenueDashboardUtils";
import RevenueMemberCardChart from "./RevenueMemberCardChart";
import RevenuePaymentDonutChart from "./RevenuePaymentDonutChart";
import RevenueTrendChart from "./RevenueTrendChart";

interface ComparisonPeriod {
  key: string;
  label: string;
  revenue: number;
  orderCount: number;
  memberCardAmount: number;
}

interface RevenueChartsProps {
  currentPeriod: ComparisonPeriod;
  comparisonPeriods?: ComparisonPeriod[];
  points: RevenueChartPoint[];
  comparisonPoints?: RevenueChartPoint[];
  paymentMethods: PaymentMethodMetric[];
  mode: RevenueDateMode;
  comparisonLabel?: string;
  comparisonCount?: number;
  onPointClick?: (key: string) => void;
}

export default function RevenueCharts({
  currentPeriod,
  comparisonPeriods = [],
  points,
  comparisonPoints,
  paymentMethods,
  mode,
  comparisonLabel,
  comparisonCount = 0,
  onPointClick,
}: RevenueChartsProps) {
  const { t } = useTranslation();
  const periodComparisonPoints = useMemo(
    () =>
      buildPeriodComparisonPoints(
        currentPeriod,
        comparisonPeriods,
        comparisonCount > 1,
      ),
    [comparisonCount, comparisonPeriods, currentPeriod],
  );
  const prepared = useMemo(
    () => prepareComparableRevenuePoints(points, comparisonPoints, mode),
    [comparisonPoints, mode, points],
  );
  const usePeriodComparison =
    comparisonCount > 1 || (comparisonCount > 0 && mode === "date");
  const displayPoints = usePeriodComparison
    ? periodComparisonPoints
    : prepared.points;
  const chartVariant = usePeriodComparison ? "period" : "timeline";
  const hasMemberCardData = displayPoints.some(
    (point) =>
      point.memberCardAmount > 0 || (point.comparisonMemberCardAmount ?? 0) > 0,
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-8">
        <RevenueTrendChart
          points={displayPoints}
          comparisonLabel={usePeriodComparison ? undefined : comparisonLabel}
          variant={chartVariant}
          title={t.revenue.charts.revenueTitle}
          onPointClick={onPointClick}
        />
      </div>
      <div className="min-w-0 xl:col-span-4">
        <RevenuePaymentDonutChart
          methods={paymentMethods}
          title={t.revenue.charts.paymentTitle}
        />
      </div>
      <div className="min-w-0 xl:col-span-12">
        <RevenueChartSummary points={displayPoints} />
      </div>
      {hasMemberCardData && (
        <div className="min-w-0 xl:col-span-12">
          <RevenueMemberCardChart
            points={displayPoints}
            comparisonLabel={usePeriodComparison ? undefined : comparisonLabel}
            variant={chartVariant}
            title={t.revenue.charts.memberCardTitle}
            onPointClick={onPointClick}
          />
        </div>
      )}
    </div>
  );
}

function buildPeriodComparisonPoints(
  current: ComparisonPeriod,
  comparisonPeriods: ComparisonPeriod[],
  selectedOnly: boolean,
): ComparableRevenueChartPoint[] {
  const periods = selectedOnly
    ? comparisonPeriods
    : [current, ...comparisonPeriods];
  return periods.map((period, index) => ({
    key: period.key,
    label: period.label,
    tooltipLabel: period.label,
    revenue: period.revenue,
    orderCount: period.orderCount,
    memberCardAmount: period.memberCardAmount,
    highlighted: !selectedOnly && index === 0,
    tooltipRole:
      selectedOnly || index > 0
        ? selectedOnly
          ? "selected"
          : "comparison"
        : "current",
  }));
}
