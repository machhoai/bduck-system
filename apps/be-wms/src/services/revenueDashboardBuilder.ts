import type {
  DeviceConsumptionItem,
  PaymentMethodMetric,
  RevenueDashboardData,
  RevenueDataSource,
  RevenueDailyRow,
  RevenueDateMode,
  RevenueMetric,
  RevenueOrderItem,
  RevenueTaxSource,
  SoldOrderGoodsItem,
  TopProductGroup,
} from "@bduck/shared-types";

import type { RevenueDateRange } from "./revenueDateRange.js";

interface RevenuePeriodData {
  dailyRows: RevenueDailyRow[];
  paymentMethods: PaymentMethodMetric[];
  topProductGroups: TopProductGroup[];
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
  deviceConsumptions?: DeviceConsumptionItem[];
}

interface BuildRevenueDashboardInput {
  source: RevenueDataSource;
  taxSource: RevenueTaxSource;
  warehouseId: string;
  warehouseName: string;
  mode: RevenueDateMode;
  range: RevenueDateRange;
  comparisonRange: RevenueDateRange;
  current: RevenuePeriodData;
  previous: RevenuePeriodData;
}

interface RevenuePeriodSummary {
  totalRevenue: number;
  cashRevenue: number;
  transferRevenue: number;
  otherRevenue: number;
  totalTax: number;
  amountBeforeTax: number;
  totalOrders: number;
  averageOrderValue: number;
}

export function buildRevenueDashboard(
  input: BuildRevenueDashboardInput,
): RevenueDashboardData {
  const current = summarize(input.current.dailyRows);
  const previous = summarize(input.previous.dailyRows);
  const granularity = input.mode === "year" ? "month" : "day";
  const chartRows = aggregateChartRows(input.current.dailyRows, granularity);

  return {
    source: input.source,
    taxSource: input.taxSource,
    warehouseId: input.warehouseId,
    warehouseName: input.warehouseName,
    mode: input.mode,
    cacheKey: buildCacheKey(input),
    range: input.range,
    comparisonLabel: input.comparisonRange.label,
    stats: {
      totalRevenue: metric(current.totalRevenue, previous.totalRevenue),
      cashRevenue: metric(current.cashRevenue, previous.cashRevenue),
      transferRevenue: metric(
        current.transferRevenue,
        previous.transferRevenue,
      ),
      otherRevenue: metric(current.otherRevenue, previous.otherRevenue),
      totalTax: metric(current.totalTax, previous.totalTax),
      amountBeforeTax: metric(
        current.amountBeforeTax,
        previous.amountBeforeTax,
      ),
      totalOrders: metric(current.totalOrders, previous.totalOrders),
      averageOrderValue: metric(
        current.averageOrderValue,
        previous.averageOrderValue,
      ),
      memberCardSales: metric(0, 0),
      deviceConsumption: metric(0, 0),
      memberCount: metric(0, 0),
      memberStoredBalance: metric(0, 0),
      memberGiftBalance: metric(0, 0),
      paymentMethods: input.current.paymentMethods,
    },
    charts: {
      granularity,
      points: chartRows.map((row) => ({
        key: row.key,
        label: row.label,
        revenue: row.revenue,
        orderCount: row.orderCount,
        memberCardAmount: 0,
        highlighted: input.range.highlightedDates.includes(row.key),
      })),
      paymentMethods: input.current.paymentMethods,
      memberCardSales: [],
    },
    dailyRows: [...input.current.dailyRows].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
    topProductGroups: input.current.topProductGroups,
    deviceConsumptions: input.current.deviceConsumptions ?? [],
    orders: input.current.orders,
    soldItems: input.current.soldItems,
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeRevenueRows(
  rows: RevenueDailyRow[],
): RevenuePeriodSummary {
  return summarize(rows);
}

function summarize(rows: RevenueDailyRow[]): RevenuePeriodSummary {
  const totals = rows.reduce(
    (result, row) => ({
      totalRevenue: result.totalRevenue + row.totalRevenue,
      cashRevenue: result.cashRevenue + row.cashRevenue,
      transferRevenue: result.transferRevenue + row.transferRevenue,
      otherRevenue: result.otherRevenue + row.otherRevenue,
      totalTax: result.totalTax + row.totalTax,
      amountBeforeTax: result.amountBeforeTax + row.amountBeforeTax,
      totalOrders: result.totalOrders + row.orderCount,
    }),
    {
      totalRevenue: 0,
      cashRevenue: 0,
      transferRevenue: 0,
      otherRevenue: 0,
      totalTax: 0,
      amountBeforeTax: 0,
      totalOrders: 0,
    },
  );
  return {
    ...totals,
    averageOrderValue:
      totals.totalOrders > 0
        ? totals.totalRevenue / totals.totalOrders
        : 0,
  };
}

function metric(value: number, previousValue: number): RevenueMetric {
  return {
    value,
    previousValue,
    changePercent:
      previousValue === 0 ? 0 : ((value - previousValue) / previousValue) * 100,
  };
}

function aggregateChartRows(
  rows: RevenueDailyRow[],
  granularity: "day" | "month",
) {
  const buckets = new Map<string, { revenue: number; orderCount: number }>();
  for (const row of rows) {
    const key = granularity === "month" ? row.date.slice(0, 7) : row.date;
    const current = buckets.get(key) ?? { revenue: 0, orderCount: 0 };
    current.revenue += row.totalRevenue;
    current.orderCount += row.orderCount;
    buckets.set(key, current);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      label:
        granularity === "month"
          ? `${key.slice(5, 7)}/${key.slice(0, 4)}`
          : `${key.slice(8, 10)}/${key.slice(5, 7)}`,
      ...value,
    }));
}

function buildCacheKey(input: BuildRevenueDashboardInput): string {
  return [
    "v3",
    input.source,
    input.warehouseId,
    input.mode,
    input.range.startDate,
    input.range.endDate,
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/gu, "_");
}
