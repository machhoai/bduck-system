import type {
  RevenueDailyRow,
  RevenuePaymentCategory,
  TopProductGroup,
} from "@bduck/shared-types";

import {
  loadLocalTaxByDate,
  type RevenuePeriodData,
} from "./localRevenueDataService.js";
import { getOpenApiConfig } from "./openApiConfigService.js";
import {
  allocateOpenApiPaymentChannels,
  normalizeOpenApiPaymentMapping,
} from "./openApiPaymentAllocation.js";
import {
  getOpenApiGoodsStatisticsForRange,
  getOpenApiRevenueData,
} from "./openApiRevenueService.js";
import { daysBetween, type RevenueDateRange } from "./revenueDateRange.js";

type JsonRecord = Record<string, unknown>;

export async function loadOpenApiRevenuePeriod(
  warehouseId: string,
  range: RevenueDateRange,
): Promise<RevenuePeriodData> {
  const [revenueResponse, goodsResponse, taxByDate, config] = await Promise.all(
    [
      getOpenApiRevenueData(warehouseId, range.startDate, range.endDate),
      getOpenApiGoodsStatisticsForRange(
        warehouseId,
        range.startDate,
        range.endDate,
      ),
      loadLocalTaxByDate(warehouseId, range),
      getOpenApiConfig(warehouseId),
    ],
  );
  const mapping = normalizeOpenApiPaymentMapping(
    config?.payment_channel_mapping ?? {},
  );
  const rowsByDate = new Map<string, RevenueDailyRow>();
  const paymentBuckets = new Map<
    string,
    { category: RevenuePaymentCategory; amount: number }
  >();

  for (const date of daysBetween(range.startDate, range.endDate)) {
    rowsByDate.set(date, emptyDailyRow(date, taxByDate[date] ?? 0));
  }

  for (const row of extractRows(revenueResponse)) {
    const date = firstText(row, ["forDate", "date"]);
    const daily = rowsByDate.get(date);
    if (!daily) continue;
    const total = firstNumber(row, [
      "realMoney",
      "shopRealMoney",
      "totalMoney",
    ]);
    const channels = allocateOpenApiPaymentChannels(row, mapping, total);
    const categoryTotal = (category: RevenuePaymentCategory) =>
      channels
        .filter((channel) => channel.category === category)
        .reduce((sum, channel) => sum + channel.amount, 0);

    daily.totalRevenue += total;
    daily.cashRevenue += categoryTotal("cash");
    daily.transferRevenue += categoryTotal("transfer");
    daily.otherRevenue += categoryTotal("other");
    daily.amountBeforeTax = Math.max(0, daily.totalRevenue - daily.totalTax);

    for (const channel of channels) {
      addPayment(
        paymentBuckets,
        channel.method,
        channel.category,
        channel.amount,
      );
    }
  }

  const dailyRows = [...rowsByDate.values()];
  const totalRevenue = dailyRows.reduce(
    (sum, row) => sum + row.totalRevenue,
    0,
  );
  return {
    dailyRows,
    paymentMethods: [...paymentBuckets.entries()]
      .map(([method, value]) => ({
        method,
        category: value.category,
        amount: value.amount,
        orderCount: 0,
        percentage: totalRevenue > 0 ? (value.amount / totalRevenue) * 100 : 0,
      }))
      .filter((item) => item.amount > 0)
      .sort((left, right) => right.amount - left.amount),
    topProductGroups: parseProductGroups(goodsResponse),
    orders: [],
    soldItems: [],
  };
}

function parseProductGroups(response: JsonRecord): TopProductGroup[] {
  return extractRows(response)
    .map((rawGroup) => {
      const groupName =
        firstText(rawGroup, [
          "goodsTypeName",
          "goodsCategory",
          "groupName",
          "categoryName",
          "showCategoryName",
          "typeName",
        ]) || "Khác";
      const items = (
        Array.isArray(rawGroup.goodsItems) ? rawGroup.goodsItems : []
      ).map((raw) => {
        const item = asRecord(raw);
        return {
          name:
            firstText(item, ["goodsName", "productName", "name"]) || "Product",
          quantity: firstNumber(item, [
            "realQty",
            "totalQty",
            "qty",
            "quantity",
          ]),
          revenue: firstNumber(item, [
            "realMoney",
            "totalRealMoney",
            "totalMoney",
          ]),
          taxAmount: 0,
        };
      });
      return {
        groupName,
        quantity:
          firstNumber(rawGroup, ["totalRealQty", "realQty", "totalQty"]) ||
          items.reduce((sum, item) => sum + item.quantity, 0),
        revenue:
          firstNumber(rawGroup, [
            "totalRealMoney",
            "realMoney",
            "totalMoney",
          ]) || items.reduce((sum, item) => sum + item.revenue, 0),
        taxAmount: 0,
        items: items.sort((left, right) => right.revenue - left.revenue),
      };
    })
    .filter((group) => group.quantity > 0 || group.revenue > 0)
    .sort((left, right) => right.revenue - left.revenue);
}

function addPayment(
  buckets: Map<string, { category: RevenuePaymentCategory; amount: number }>,
  method: string,
  category: RevenuePaymentCategory,
  amount: number,
) {
  if (amount <= 0) return;
  const current = buckets.get(method) ?? { category, amount: 0 };
  current.amount += amount;
  buckets.set(method, current);
}

function emptyDailyRow(date: string, totalTax: number): RevenueDailyRow {
  return {
    date,
    totalRevenue: 0,
    cashRevenue: 0,
    transferRevenue: 0,
    otherRevenue: 0,
    totalTax,
    amountBeforeTax: 0,
    orderCount: 0,
  };
}

function extractRows(response: JsonRecord): JsonRecord[] {
  const data = response.data;
  if (Array.isArray(data)) return data.map(asRecord);
  const record = asRecord(data);
  for (const candidate of [record.dataXs, record.rows, record.items]) {
    if (Array.isArray(candidate)) return candidate.map(asRecord);
  }
  return [];
}

function firstText(row: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function firstNumber(row: JsonRecord, keys: string[]): number {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}
