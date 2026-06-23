import {
  getGoodsTypeStatistics,
  getJoyworldToken,
  getOrderList,
  getRevenueData,
  getSellData,
  getStoreBalance,
} from "./joyworldService.js";

export const LANDMARK_81_WAREHOUSE_ID = "2fa83576-277f-483e-8c52-2ec85b9a8cff";

export type RevenueDateMode = "today" | "date" | "month" | "year" | "custom";
export type RevenueChartGranularity = "day" | "month";

export interface RevenueDashboardParams {
  mode: RevenueDateMode;
  date?: string;
  month?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
}

export interface RevenueMetric {
  value: number;
  previousValue: number;
  changePercent: number;
}

export interface PaymentMethodMetric {
  method: string;
  amount: number;
  orderCount: number;
  percentage: number;
}

export interface RevenueChartPoint {
  key: string;
  label: string;
  revenue: number;
  orderCount: number;
  memberCardAmount: number;
  highlighted: boolean;
}

export interface TopProductItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopProductGroup {
  groupName: string;
  quantity: number;
  revenue: number;
  items: TopProductItem[];
}

export interface RevenueDashboardData {
  warehouseId: string;
  warehouseName: string;
  mode: RevenueDateMode;
  range: {
    startDate: string;
    endDate: string;
    label: string;
    highlightedDates: string[];
  };
  comparisonLabel: string;
  stats: {
    totalRevenue: RevenueMetric;
    totalOrders: RevenueMetric;
    averageOrderValue: RevenueMetric;
    memberCardSales: RevenueMetric;
    paymentMethods: PaymentMethodMetric[];
  };
  charts: {
    granularity: RevenueChartGranularity;
    points: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    memberCardSales: RevenueChartPoint[];
  };
  topProductGroups: TopProductGroup[];
  generatedAt: string;
}

type JsonRecord = Record<string, unknown>;

interface DateRange {
  startDate: string;
  endDate: string;
}

interface NormalizedRange extends DateRange {
  label: string;
  highlightedDates: string[];
  comparison: DateRange;
  comparisonLabel: string;
}

const REVENUE_KEYS = ["realMoney", "shopRealMoney", "totalMoney", "salesMoney", "amount", "money"];
const MEMBER_CARD_KEYS = ["localCurrency", "newMemberLocalCurrency", "rechargeMoney", "totalMoney"];
const PRODUCT_NAME_KEYS = ["goodsName", "giftName", "setMealName", "productName", "name"];
const PRODUCT_GROUP_KEYS = ["typeName", "goodsTypeName", "categoryName", "groupName"];
const PRODUCT_QTY_KEYS = ["sellAmount", "sellCount", "quantity", "count", "num", "amount"];
const PRODUCT_REVENUE_KEYS = ["realMoney", "sellMoney", "totalMoney", "salesMoney", "money"];

export async function getRevenueDashboardData(
  params: RevenueDashboardParams,
): Promise<RevenueDashboardData> {
  const normalized = normalizeRange(params);
  const chartWindow = getChartWindow(params, normalized);
  const token = await getJoyworldToken();

  const [
    selectedRevenue,
    comparisonRevenue,
    selectedOrders,
    comparisonOrders,
    selectedMembers,
    comparisonMembers,
    chartRevenue,
    chartOrders,
    chartMembers,
    sellResponse,
    goodsTypeResponses,
  ] = await Promise.all([
    getRevenueData(token, normalized.startDate, normalized.endDate),
    getRevenueData(token, normalized.comparison.startDate, normalized.comparison.endDate),
    fetchOrderSummary(token, normalized),
    fetchOrderSummary(token, normalized.comparison),
    getStoreBalance(token, normalized.startDate, normalized.endDate),
    getStoreBalance(token, normalized.comparison.startDate, normalized.comparison.endDate),
    getRevenueData(token, chartWindow.startDate, chartWindow.endDate),
    fetchChartOrderSummaries(token, chartWindow),
    fetchChartMemberSummaries(token, chartWindow),
    getSellData(token, normalized.startDate, normalized.endDate),
    fetchDailyResponses(daysBetween(normalized.startDate, normalized.endDate), (day) =>
      getGoodsTypeStatistics(token, day),
    ),
  ]);

  const selectedRevenueTotal = sumRevenue(selectedRevenue, normalized);
  const comparisonRevenueTotal = sumRevenue(comparisonRevenue, normalized.comparison);
  const selectedMemberTotal = sumMemberCardSales(selectedMembers);
  const comparisonMemberTotal = sumMemberCardSales(comparisonMembers);
  const selectedOrderCount = selectedOrders.orderCount;
  const comparisonOrderCount = comparisonOrders.orderCount;
  const selectedAverageOrderValue = selectedOrderCount > 0 ? selectedRevenueTotal / selectedOrderCount : 0;
  const comparisonAverageOrderValue =
    comparisonOrderCount > 0 ? comparisonRevenueTotal / comparisonOrderCount : 0;

  const chartPoints = buildChartPoints({
    params,
    normalized,
    chartWindow,
    revenueResponse: chartRevenue,
    orderSummaries: chartOrders,
    memberSummaries: chartMembers,
  });
  const paymentMethods = parsePaymentMethodsFromRevenue(
    selectedRevenue,
    selectedOrderCount,
    normalized,
  );

  return {
    warehouseId: LANDMARK_81_WAREHOUSE_ID,
    warehouseName: "B.Duck Cityfuns Landmark 81",
    mode: params.mode,
    range: {
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      label: normalized.label,
      highlightedDates: normalized.highlightedDates,
    },
    comparisonLabel: normalized.comparisonLabel,
    stats: {
      totalRevenue: toMetric(selectedRevenueTotal, comparisonRevenueTotal),
      totalOrders: toMetric(selectedOrderCount, comparisonOrderCount),
      averageOrderValue: toMetric(selectedAverageOrderValue, comparisonAverageOrderValue),
      memberCardSales: toMetric(selectedMemberTotal, comparisonMemberTotal),
      paymentMethods,
    },
    charts: {
      granularity: params.mode === "year" ? "month" : "day",
      points: chartPoints,
      paymentMethods,
      memberCardSales: chartPoints.map((point) => ({
        ...point,
        revenue: point.memberCardAmount,
      })),
    },
    topProductGroups: buildTopProducts(sellResponse, goodsTypeResponses),
    generatedAt: new Date().toISOString(),
  };
}

function normalizeRange(params: RevenueDashboardParams): NormalizedRange {
  const today = formatDate(new Date());
  if (params.mode === "year") {
    const year = Number(params.year || today.slice(0, 4));
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    return withComparison({ startDate, endDate, label: String(year), highlightedDates: [] }, "year");
  }

  if (params.mode === "month") {
    const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : today.slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = endOfMonth(startDate);
    return withComparison({
      startDate,
      endDate,
      label: month,
      highlightedDates: today >= startDate && today <= endDate ? [today] : [],
    }, "month");
  }

  if (params.mode === "custom") {
    const startDate = normalizeDate(params.startDate || today);
    const endDate = normalizeDate(params.endDate || startDate);
    const ordered = startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
    return withComparison({
      ...ordered,
      label: `${ordered.startDate} - ${ordered.endDate}`,
      highlightedDates: daysBetween(ordered.startDate, ordered.endDate),
    }, "custom");
  }

  const date = normalizeDate(params.mode === "today" ? today : params.date || today);
  return withComparison({ startDate: date, endDate: date, label: date, highlightedDates: [date] }, "date");
}

function withComparison(
  range: DateRange & { label: string; highlightedDates: string[] },
  mode: "date" | "month" | "year" | "custom",
): NormalizedRange {
  const days = diffDays(range.startDate, range.endDate) + 1;
  let comparison: DateRange;
  let comparisonLabel = "previousPeriod";

  if (mode === "date") {
    comparison = { startDate: addDays(range.startDate, -1), endDate: addDays(range.endDate, -1) };
    comparisonLabel = "yesterday";
  } else if (mode === "month") {
    const previousMonthDate = addMonths(range.startDate, -1);
    comparison = { startDate: startOfMonth(previousMonthDate), endDate: endOfMonth(previousMonthDate) };
    comparisonLabel = "previousMonth";
  } else if (mode === "year") {
    const year = Number(range.startDate.slice(0, 4)) - 1;
    comparison = { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    comparisonLabel = "previousYear";
  } else {
    comparison = {
      startDate: addDays(range.startDate, -days),
      endDate: addDays(range.startDate, -1),
    };
  }

  return { ...range, comparison, comparisonLabel };
}

function getChartWindow(params: RevenueDashboardParams, range: NormalizedRange): DateRange {
  if (params.mode === "year") return range;
  if (params.mode === "custom") {
    const selectedDays = diffDays(range.startDate, range.endDate) + 1;
    if (selectedDays > 7) return { startDate: range.startDate, endDate: range.endDate };
    const midpoint = addDays(range.startDate, Math.floor((selectedDays - 1) / 2));
    return { startDate: addDays(midpoint, -3), endDate: addDays(midpoint, 3) };
  }
  return { startDate: startOfMonth(range.startDate), endDate: endOfMonth(range.startDate) };
}

async function fetchOrderSummary(token: string, range: DateRange): Promise<{ orderCount: number }> {
  const response = await getOrderList(token, {
    startTime: `${range.startDate} 00:00:00`,
    endTime: `${range.endDate} 23:59:59`,
    page: 1,
    limit: 1,
  });
  return { orderCount: extractTotalCount(response) };
}

async function fetchChartOrderSummaries(
  token: string,
  range: DateRange,
): Promise<Record<string, number>> {
  if (diffDays(range.startDate, range.endDate) > 62) {
    const months = monthsBetween(range.startDate, range.endDate);
    const summaries = await mapLimit(months, 4, (month) =>
      fetchOrderSummary(token, { startDate: `${month}-01`, endDate: endOfMonth(`${month}-01`) }),
    );
    return Object.fromEntries(months.map((month, index) => [`${month}-01`, summaries[index]?.orderCount ?? 0]));
  }
  const days = daysBetween(range.startDate, range.endDate);
  const summaries = await fetchDailyResponses(days, (day) => fetchOrderSummary(token, { startDate: day, endDate: day }));
  return Object.fromEntries(days.map((day, index) => [day, summaries[index]?.orderCount ?? 0]));
}

async function fetchChartMemberSummaries(
  token: string,
  range: DateRange,
): Promise<Record<string, number>> {
  if (diffDays(range.startDate, range.endDate) > 62) {
    const months = monthsBetween(range.startDate, range.endDate);
    const summaries = await mapLimit(months, 4, (month) =>
      getStoreBalance(token, `${month}-01`, endOfMonth(`${month}-01`)),
    );
    return Object.fromEntries(months.map((month, index) => [`${month}-01`, sumMemberCardSales(summaries[index])]));
  }
  const days = daysBetween(range.startDate, range.endDate);
  const summaries = await fetchDailyResponses(days, (day) => getStoreBalance(token, day, day));
  return Object.fromEntries(days.map((day, index) => [day, sumMemberCardSales(summaries[index])]));
}

async function fetchDailyResponses<T>(
  days: string[],
  fetcher: (day: string) => Promise<T>,
): Promise<T[]> {
  return mapLimit(days, 5, fetcher);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function buildChartPoints(args: {
  params: RevenueDashboardParams;
  normalized: NormalizedRange;
  chartWindow: DateRange;
  revenueResponse: JsonRecord;
  orderSummaries: Record<string, number>;
  memberSummaries: Record<string, number>;
}): RevenueChartPoint[] {
  const { params, normalized, chartWindow, revenueResponse, orderSummaries, memberSummaries } = args;
  const highlighted = new Set(normalized.highlightedDates);

  if (params.mode === "year") {
    const year = chartWindow.startDate.slice(0, 4);
    const dailyRevenue = revenueByDate(revenueResponse);
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      const monthDays = daysBetween(`${month}-01`, endOfMonth(`${month}-01`));
      return {
        key: month,
        label: `T${index + 1}`,
        revenue: sumByDays(dailyRevenue, monthDays),
        orderCount: sumByDays(orderSummaries, monthDays),
        memberCardAmount: sumByDays(memberSummaries, monthDays),
        highlighted: false,
      };
    });
  }

  const dailyRevenue = revenueByDate(revenueResponse);
  return daysBetween(chartWindow.startDate, chartWindow.endDate).map((day) => ({
    key: day,
    label: day.slice(8, 10),
    revenue: dailyRevenue[day] ?? 0,
    orderCount: orderSummaries[day] ?? 0,
    memberCardAmount: memberSummaries[day] ?? 0,
    highlighted: highlighted.has(day),
  }));
}

function sumRevenue(response: JsonRecord, range: DateRange): number {
  const byDate = revenueByDate(response);
  const values = daysBetween(range.startDate, range.endDate).map((day) => byDate[day] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total > 0) return total;
  return sumRows(extractRows(response), REVENUE_KEYS);
}

function revenueByDate(response: JsonRecord): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of extractRows(response)) {
    const date = getDateField(row);
    if (!date) continue;
    result[date] = (result[date] ?? 0) + firstNumber(row, REVENUE_KEYS);
  }
  return result;
}

function parsePaymentMethodsFromRevenue(
  response: JsonRecord,
  orderCount: number,
  range: DateRange,
): PaymentMethodMetric[] {
  let cashAmount = 0;
  let transferAmount = 0;
  const selectedDays = new Set(daysBetween(range.startDate, range.endDate));

  for (const row of extractRows(response)) {
    const rowDate = getDateField(row);
    if (rowDate && !selectedDays.has(rowDate)) continue;
    cashAmount += firstNumber(row, ["cashRealMoney", "cashMoney", "cashSysMoney"]);
    transferAmount += firstNumber(row, ["transferRealMoney", "transferMoney", "transferSysMoney"]);
  }

  const totalAmount = cashAmount + transferAmount;
  const toMethod = (method: "transfer" | "cash", amount: number): PaymentMethodMetric => ({
    method,
    amount,
    orderCount: totalAmount > 0 ? Math.round((amount / totalAmount) * orderCount) : 0,
    percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
  });

  return [toMethod("transfer", transferAmount), toMethod("cash", cashAmount)];
}

function buildTopProducts(
  sellResponse: JsonRecord,
  goodsTypeResponses: JsonRecord[],
): TopProductGroup[] {
  const groups = new Map<string, TopProductGroup>();
  const rows = extractRows(sellResponse);
  const fallbackRows = goodsTypeResponses.flatMap((response) => extractRows(response));

  for (const row of rows.length > 0 ? rows : fallbackRows) {
    const groupName = firstString(row, PRODUCT_GROUP_KEYS) || "Other";
    const productName = firstString(row, PRODUCT_NAME_KEYS) || groupName;
    const quantity = firstNumber(row, PRODUCT_QTY_KEYS);
    const revenue = firstNumber(row, PRODUCT_REVENUE_KEYS);
    const group = groups.get(groupName) ?? { groupName, quantity: 0, revenue: 0, items: [] };
    group.quantity += quantity;
    group.revenue += revenue;
    const existing = group.items.find((item) => item.name === productName);
    if (existing) {
      existing.quantity += quantity;
      existing.revenue += revenue;
    } else {
      group.items.push({ name: productName, quantity, revenue });
    }
    groups.set(groupName, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

function sumMemberCardSales(response: JsonRecord | undefined): number {
  if (!response) return 0;
  const responseFootData = asRecord(response.footData);
  const dataFootData = asRecord(asRecord(response.data).footData);
  const footData = Object.keys(responseFootData).length > 0 ? responseFootData : dataFootData;
  const footTotal = firstNumber(footData, MEMBER_CARD_KEYS);
  if (footTotal > 0) return footTotal;
  return sumRows(extractRows(response), MEMBER_CARD_KEYS);
}

function extractRows(response: JsonRecord): JsonRecord[] {
  const data = asRecord(response.data);
  const candidates = [
    data.dataXs,
    data.records,
    data.rows,
    data.list,
    data.items,
    response.data,
    response.records,
    response.rows,
    response.list,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(asRecord).filter((row) => Object.keys(row).length > 0);
  }
  return [];
}

function extractTotalCount(response: JsonRecord): number {
  const data = asRecord(response.data);
  return firstNumber(response, ["totals", "total", "count"]) || firstNumber(data, ["totals", "total", "count"]);
}

function sumRows(rows: JsonRecord[], keys: string[]): number {
  return rows.reduce((sum, row) => sum + firstNumber(row, keys), 0);
}

function sumByDays(source: Record<string, number>, days: string[]): number {
  return days.reduce((sum, day) => sum + (source[day] ?? 0), 0);
}

function firstNumber(row: JsonRecord, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/,/g, ""))
          : 0;
    if (Number.isFinite(numberValue) && numberValue !== 0) return numberValue;
  }
  return 0;
}

function firstString(row: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getDateField(row: JsonRecord): string {
  const value = firstString(row, ["forDate", "date", "day", "statDate", "businessDate"]);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function toMetric(value: number, previousValue: number): RevenueMetric {
  return {
    value,
    previousValue,
    changePercent: previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0,
  };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function normalizeDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : formatDate(new Date());
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function addMonths(value: string, months: number): string {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
}

function startOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function endOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return formatDate(new Date(year, month, 0));
}

function diffDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  return Math.round((end - start) / 86_400_000);
}

function daysBetween(startDate: string, endDate: string): string[] {
  const total = diffDays(startDate, endDate);
  return Array.from({ length: total + 1 }, (_, index) => addDays(startDate, index));
}

function monthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let cursor = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  while (cursor <= end) {
    months.push(cursor.slice(0, 7));
    cursor = startOfMonth(addMonths(cursor, 1));
  }
  return months;
}
