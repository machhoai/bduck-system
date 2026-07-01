import type { PaymentMethodMetric, RevenueChartPoint, RevenueDateMode, RevenueMetric } from "@/hooks/useRevenueDashboard";

export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

export function formatAxisValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function getMetricTone(metric: RevenueMetric): "up" | "down" | "flat" {
  if (metric.changePercent > 0) return "up";
  if (metric.changePercent < 0) return "down";
  return "flat";
}

export function getPaymentTotal(methods: PaymentMethodMetric[]): number {
  return methods.reduce((sum, item) => sum + item.amount, 0);
}

export type RevenueChartAggregation = "day" | "week" | "month";

export interface ComparableRevenueChartPoint extends RevenueChartPoint {
  comparisonRevenue?: number;
  comparisonOrderCount?: number;
  comparisonMemberCardAmount?: number;
  tooltipLabel?: string;
  comparisonTooltipLabel?: string;
  tooltipRole?: "current" | "comparison" | "selected";
}

export function prepareComparableRevenuePoints(
  points: RevenueChartPoint[],
  comparisonPoints?: RevenueChartPoint[],
  mode: RevenueDateMode = "custom",
): { points: ComparableRevenueChartPoint[]; aggregation: RevenueChartAggregation } {
  const aggregation = getAggregation(points, mode);
  const current = aggregateRevenuePoints(points, aggregation);
  const comparison = comparisonPoints ? aggregateRevenuePoints(comparisonPoints, aggregation) : [];

  return {
    aggregation,
    points: current.map((point, index) => {
      const comparePoint = comparison[index];
      return {
        ...point,
        tooltipLabel: formatPointTooltipLabel(point),
        tooltipRole: "current",
        comparisonRevenue: comparePoint?.revenue,
        comparisonOrderCount: comparePoint?.orderCount,
        comparisonMemberCardAmount: comparePoint?.memberCardAmount,
        comparisonTooltipLabel: comparePoint ? formatPointTooltipLabel(comparePoint) : undefined,
      };
    }),
  };
}

export function sumComparablePointValue(
  points: ComparableRevenueChartPoint[],
  key: "revenue" | "orderCount" | "memberCardAmount",
): { current: number; comparison: number } {
  const comparisonKey =
    key === "revenue"
      ? "comparisonRevenue"
      : key === "orderCount"
        ? "comparisonOrderCount"
        : "comparisonMemberCardAmount";

  return points.reduce(
    (acc, point) => ({
      current: acc.current + point[key],
      comparison: acc.comparison + (point[comparisonKey] ?? 0),
    }),
    { current: 0, comparison: 0 },
  );
}

function getAggregation(points: RevenueChartPoint[], mode: RevenueDateMode): RevenueChartAggregation {
  if (points.some((point) => /^\d{4}-\d{2}$/.test(point.key))) return "month";
  if (mode !== "custom") return "day";
  if (points.length > 62) return "month";
  if (points.length > 31) return "week";
  return "day";
}

function aggregateRevenuePoints(points: RevenueChartPoint[], aggregation: RevenueChartAggregation): RevenueChartPoint[] {
  if (aggregation === "day") return points;
  if (aggregation === "week") {
    const chunks: RevenueChartPoint[] = [];
    for (let index = 0; index < points.length; index += 7) {
      chunks.push(mergePointGroup(points.slice(index, index + 7), "week"));
    }
    return chunks;
  }

  const groups = new Map<string, RevenueChartPoint[]>();
  for (const point of points) {
    const key = point.key.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => mergePointGroup(group, "month"));
}

function mergePointGroup(points: RevenueChartPoint[], aggregation: RevenueChartAggregation): RevenueChartPoint {
  const first = points[0];
  const last = points[points.length - 1] ?? first;
  return {
    key: aggregation === "month" ? (first?.key ?? "").slice(0, 7) : first?.key ?? "",
    label: getGroupLabel(first?.key ?? "", last?.key ?? "", aggregation),
    revenue: points.reduce((sum, point) => sum + point.revenue, 0),
    orderCount: points.reduce((sum, point) => sum + point.orderCount, 0),
    memberCardAmount: points.reduce((sum, point) => sum + point.memberCardAmount, 0),
    highlighted: points.some((point) => point.highlighted),
  };
}

function getGroupLabel(startKey: string, endKey: string, aggregation: RevenueChartAggregation): string {
  if (aggregation === "month") {
    const month = startKey.slice(5, 7);
    const year = startKey.slice(2, 4);
    return `T${Number(month)}/${year}`;
  }
  if (aggregation === "week") return `${formatFullDate(startKey)} - ${formatFullDate(endKey)}`;
  return startKey;
}

function formatFullDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function formatPointTooltipLabel(point: RevenueChartPoint): string {
  if (point.label.includes(" - ")) return `Tuần ${point.label}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(point.key)) return `Ngày ${formatFullDate(point.key)}`;
  if (/^\d{4}-\d{2}$/.test(point.key)) return `Tháng ${point.key.slice(5, 7)}/${point.key.slice(0, 4)}`;
  return point.label;
}

export const chartColors = {
  blue: "#0066cc",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#f59e0b",
  slate: "#64748b",
  cyan: "#0891b2",
  violet: "#7c3aed",
};

export const donutColors = [
  "#0066cc",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#0891b2",
  "#7c3aed",
  "#e11d48",
  "#0d9488",
];
