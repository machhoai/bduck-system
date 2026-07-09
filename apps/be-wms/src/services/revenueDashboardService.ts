import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import {
  getCashierSummary,
  getCoinStatistics,
  getGoodsStatistics,
  getJoyworldToken,
  getOrderGoodsList,
  getOrderList,
  getRevenueData,
  getStoreBalance,
} from "./joyworldService.js";
import { hasEnabledOpenApiConfig } from "./openApiConfigService.js";
import {
  getOpenApiGoodsStatistics,
  getOpenApiRevenueData,
} from "./openApiRevenueService.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";

export const LANDMARK_81_WAREHOUSE_ID = "2fa83576-277f-483e-8c52-2ec85b9a8cff";

export type RevenueDateMode = "today" | "date" | "month" | "year" | "custom";
export type RevenueChartGranularity = "day" | "month";

export interface RevenueDashboardParams {
  mode: RevenueDateMode;
  warehouseId?: string;
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

export interface DeviceConsumptionItem {
  date: string;
  electronicCoinConsum: number;
  physicalCoinConsum: number;
  totalConsum: number;
  coinGiveQuantity: number;
  coinConsumRate: string;
}

export interface RevenueOrderItem {
  orderId: string;
  orderNumber: string;
  status: number;
  statusLabel: string;
  createTime: string;
  employeeName: string;
  payMethod: string;
  terminalName: string;
  totalQty: number;
  itemCount: number;
  sysMoney: number;
  discountMoney: number;
  realMoney: number;
  cancelMoney: number;
}

export interface SoldOrderGoodsItem {
  id: string;
  orderId: string;
  orderNumber: string;
  status: number;
  statusLabel: string;
  createTime: string;
  employeeName: string;
  payMethod: string;
  goodsName: string;
  goodsTypeName: string;
  categoryName: string;
  price: number;
  qty: number;
  sysMoney: number;
  discountMoney: number;
  realMoney: number;
  cancelQty: number;
  cancelMoney: number;
}

export interface RevenueDashboardData {
  warehouseId: string;
  warehouseName: string;
  mode: RevenueDateMode;
  cacheKey: string;
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
    deviceConsumption: RevenueMetric;
    memberCount: RevenueMetric;
    memberStoredBalance: RevenueMetric;
    memberGiftBalance: RevenueMetric;
    paymentMethods: PaymentMethodMetric[];
  };
  charts: {
    granularity: RevenueChartGranularity;
    points: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    memberCardSales: RevenueChartPoint[];
  };
  topProductGroups: TopProductGroup[];
  deviceConsumptions: DeviceConsumptionItem[];
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
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

interface CoinStat {
  coinSalesAmount: number;
  coinSalesQuantity: number;
  coinGiveQuantity: number;
  electronicCoinConsum: number;
  physicalCoinConsum: number;
  coinConsumRate: string;
}

interface MemberSnapshot {
  memberTotal: number;
  newMemberAmount: number;
  currency: number;
  localCurrency: number;
  giftCoins: number;
}

const DASHBOARD_COLLECTION = "revenue_dashboards";
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const REVENUE_KEYS = ["realMoney", "shopRealMoney", "totalMoney", "salesMoney", "amount", "money"];

export function getRevenueDashboardCacheKey(params: RevenueDashboardParams): string {
  const normalized = normalizeRange(params);
  return buildCacheKey(params.warehouseId || LANDMARK_81_WAREHOUSE_ID, params.mode, normalized);
}

export async function getRevenueDashboardData(
  params: RevenueDashboardParams,
  userId = "system",
): Promise<RevenueDashboardData> {
  const normalized = normalizeRange(params);
  const warehouseId = params.warehouseId || LANDMARK_81_WAREHOUSE_ID;
  const cacheKey = buildCacheKey(warehouseId, params.mode, normalized);
  const docRef = db.collection(DASHBOARD_COLLECTION).doc(cacheKey);
  const cachedSnap = await docRef.get();

  if (cachedSnap.exists) {
    const cached = cachedSnap.data() as { dashboard?: RevenueDashboardData; sync_time?: FirebaseFirestore.Timestamp | null };
    if (cached.dashboard && !isStale(cached.sync_time ?? null)) {
      return hydrateDashboardRows(cached.dashboard, docRef);
    }
  }

  const dashboard = await fetchRevenueDashboardData(params, normalized, cacheKey);
  const dashboardSummary: RevenueDashboardData = {
    ...dashboard,
    orders: [],
    soldItems: [],
  };
  await docRef.set(
    {
      cacheKey,
      mode: params.mode,
      range: dashboard.range,
      dashboard: dashboardSummary,
      sync_time: FieldValue.serverTimestamp(),
      synced_by: userId,
    },
    { merge: true },
  );
  await Promise.all([
    writeCollectionRows(docRef.collection("orders"), dashboard.orders, (row) => row.orderId),
    writeCollectionRows(docRef.collection("sold_items"), dashboard.soldItems, (row) => row.id),
  ]);

  return dashboard;
}

async function fetchRevenueDashboardData(
  params: RevenueDashboardParams,
  normalized: NormalizedRange,
  cacheKey: string,
): Promise<RevenueDashboardData> {
  const chartWindow = getChartWindow(params, normalized);
  const warehouseId = params.warehouseId || LANDMARK_81_WAREHOUSE_ID;
  const warehouse = await warehouseRepository.findById(warehouseId);
  const token = await getLegacyJoyworldTokenOrNull();
  const selectedDays = daysBetween(normalized.startDate, normalized.endDate);
  const comparisonDays = daysBetween(normalized.comparison.startDate, normalized.comparison.endDate);
  const chartDays = daysBetween(chartWindow.startDate, chartWindow.endDate);
  const coinDays = Array.from(new Set([...selectedDays, ...comparisonDays, ...chartDays]));

  const [
    selectedRevenue,
    comparisonRevenue,
    selectedOrders,
    comparisonOrders,
    selectedOrderRows,
    selectedMembers,
    comparisonMembers,
    chartRevenue,
    chartOrders,
    coinStatsByDate,
    goodsResponses,
    cashierResponses,
  ] = await Promise.all([
    getRevenueDataForWarehouse(warehouseId, token, normalized.startDate, normalized.endDate),
    getRevenueDataForWarehouse(warehouseId, token, normalized.comparison.startDate, normalized.comparison.endDate),
    fetchOrderSummary(token, normalized),
    fetchOrderSummary(token, normalized.comparison),
    fetchOrderGoodsRows(token, normalized),
    token ? getStoreBalance(token, normalized.startDate, normalized.endDate) : emptyResponse(),
    token ? getStoreBalance(token, normalized.comparison.startDate, normalized.comparison.endDate) : emptyResponse(),
    getRevenueDataForWarehouse(warehouseId, token, chartWindow.startDate, chartWindow.endDate),
    fetchChartOrderSummaries(token, chartWindow),
    fetchCoinStatsByDate(token, coinDays),
    fetchDailyResponses(selectedDays, (day) => getGoodsStatisticsForWarehouse(warehouseId, token, day)),
    token ? fetchDailyResponses(selectedDays, (day) => getCashierSummary(token, day)) : [],
  ]);

  const selectedRevenueTotal = sumRevenue(selectedRevenue, normalized);
  const comparisonRevenueTotal = sumRevenue(comparisonRevenue, normalized.comparison);
  const selectedOrderCount = uniqueOrderCount(selectedOrderRows) || selectedOrders.orderCount;
  const comparisonOrderCount = comparisonOrders.orderCount;
  const selectedAverageOrderValue = selectedOrderCount > 0 ? selectedRevenueTotal / selectedOrderCount : 0;
  const comparisonAverageOrderValue =
    comparisonOrderCount > 0 ? comparisonRevenueTotal / comparisonOrderCount : 0;
  const selectedMemberTotal = sumCoinStats(coinStatsByDate, selectedDays, "coinSalesAmount");
  const comparisonMemberTotal = sumCoinStats(coinStatsByDate, comparisonDays, "coinSalesAmount");
  const selectedDeviceConsum = sumDeviceConsumption(coinStatsByDate, selectedDays);
  const comparisonDeviceConsum = sumDeviceConsumption(coinStatsByDate, comparisonDays);
  const selectedMemberSnapshot = parseLatestMemberSnapshot(selectedMembers);
  const comparisonMemberSnapshot = parseLatestMemberSnapshot(comparisonMembers);

  const chartPoints = buildChartPoints({
    params,
    normalized,
    chartWindow,
    revenueResponse: chartRevenue,
    orderSummaries: chartOrders,
    coinStatsByDate,
  });
  const orderData = buildOrderData(selectedOrderRows);
  const paymentMethods = parsePaymentMethodsFromOrders(orderData.orders, cashierResponses);

  return {
    warehouseId,
    warehouseName: warehouse?.name || "B.Duck Cityfuns Landmark 81",
    mode: params.mode,
    cacheKey,
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
      deviceConsumption: toMetric(selectedDeviceConsum, comparisonDeviceConsum),
      memberCount: toMetric(selectedMemberSnapshot.memberTotal, comparisonMemberSnapshot.memberTotal),
      memberStoredBalance: toMetric(selectedMemberSnapshot.localCurrency, comparisonMemberSnapshot.localCurrency),
      memberGiftBalance: toMetric(selectedMemberSnapshot.giftCoins, comparisonMemberSnapshot.giftCoins),
      paymentMethods,
    },
    charts: {
      granularity: params.mode === "year" ? "month" : "day",
      points: chartPoints,
      paymentMethods,
      memberCardSales: chartPoints.map((point) => ({ ...point, revenue: point.memberCardAmount })),
    },
    topProductGroups: buildTopProducts(goodsResponses),
    deviceConsumptions: buildDeviceConsumptions(coinStatsByDate, selectedDays),
    orders: orderData.orders,
    soldItems: orderData.soldItems,
    generatedAt: new Date().toISOString(),
  };
}

function normalizeRange(params: RevenueDashboardParams): NormalizedRange {
  const today = formatDate(new Date());
  if (params.mode === "year") {
    const year = Number(params.year || today.slice(0, 4));
    return withComparison({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: String(year),
      highlightedDates: [],
    }, "year");
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

async function getLegacyJoyworldTokenOrNull(): Promise<string | null> {
  try {
    return await getJoyworldToken();
  } catch (error) {
    console.warn("[revenueDashboard] Legacy JoyWorld token unavailable:", error);
    return null;
  }
}

async function getRevenueDataForWarehouse(
  warehouseId: string,
  token: string | null,
  startDate: string,
  endDate: string,
): Promise<JsonRecord> {
  if (await hasEnabledOpenApiConfig(warehouseId)) {
    return getOpenApiRevenueData(warehouseId, startDate, endDate);
  }
  if (!token) return emptyResponse();
  return getRevenueData(token, startDate, endDate);
}

async function getGoodsStatisticsForWarehouse(
  warehouseId: string,
  token: string | null,
  forDate: string,
): Promise<JsonRecord> {
  if (await hasEnabledOpenApiConfig(warehouseId)) {
    return getOpenApiGoodsStatistics(warehouseId, forDate);
  }
  if (!token) return emptyResponse();
  return getGoodsStatistics(token, forDate);
}

function emptyResponse(): JsonRecord {
  return { success: true, data: [] };
}

async function fetchOrderSummary(token: string | null, range: DateRange): Promise<{ orderCount: number }> {
  if (!token) return { orderCount: 0 };
  const response = await getOrderList(token, {
    startTime: `${range.startDate} 00:00:00`,
    endTime: `${range.endDate} 23:59:59`,
    page: 1,
    limit: 1,
  });
  return { orderCount: extractTotalCount(response) };
}

async function fetchOrderGoodsRows(token: string | null, range: DateRange): Promise<JsonRecord[]> {
  if (!token) return [];
  const limit = 200;
  const rows: JsonRecord[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (rows.length < total && page <= 20) {
    const response = await getOrderGoodsList(token, {
      startTime: `${range.startDate} 00:00:00`,
      endTime: `${range.endDate} 23:59:59`,
      page,
      limit,
    });
    const pageRows = extractRows(response);
    rows.push(...pageRows);
    total = extractTotalCount(response) || rows.length;
    if (pageRows.length < limit) break;
    page += 1;
  }

  return rows;
}

async function fetchChartOrderSummaries(token: string | null, range: DateRange): Promise<Record<string, number>> {
  if (!token) return {};
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

async function fetchCoinStatsByDate(token: string | null, days: string[]): Promise<Record<string, CoinStat>> {
  if (!token) return {};
  const responses = await mapLimit(days, 6, (day) => getCoinStatistics(token, day));
  return Object.fromEntries(days.map((day, index) => [day, parseCoinStat(responses[index])]));
}

async function fetchDailyResponses<T>(days: string[], fetcher: (day: string) => Promise<T>): Promise<T[]> {
  return mapLimit(days, 5, fetcher);
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
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
  coinStatsByDate: Record<string, CoinStat>;
}): RevenueChartPoint[] {
  const { params, normalized, chartWindow, revenueResponse, orderSummaries, coinStatsByDate } = args;
  const highlighted = new Set(normalized.highlightedDates);
  const dailyRevenue = revenueByDate(revenueResponse);

  if (params.mode === "year") {
    const year = chartWindow.startDate.slice(0, 4);
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      const monthDays = daysBetween(`${month}-01`, endOfMonth(`${month}-01`));
      return {
        key: month,
        label: `T${index + 1}`,
        revenue: sumByDays(dailyRevenue, monthDays),
        orderCount: sumByDays(orderSummaries, monthDays),
        memberCardAmount: sumCoinStats(coinStatsByDate, monthDays, "coinSalesAmount"),
        highlighted: false,
      };
    });
  }

  return daysBetween(chartWindow.startDate, chartWindow.endDate).map((day) => ({
    key: day,
    label: day.slice(8, 10),
    revenue: dailyRevenue[day] ?? 0,
    orderCount: orderSummaries[day] ?? 0,
    memberCardAmount: coinStatsByDate[day]?.coinSalesAmount ?? 0,
    highlighted: highlighted.has(day),
  }));
}

function buildOrderData(rows: JsonRecord[]): { orders: RevenueOrderItem[]; soldItems: SoldOrderGoodsItem[] } {
  const orderMap = new Map<string, RevenueOrderItem>();
  const soldItems: SoldOrderGoodsItem[] = [];

  for (const row of rows) {
    const orderId = firstString(row, ["orderId"]) || firstString(row, ["id"]);
    if (!orderId) continue;
    const status = firstNumber(row, ["status"]);
    const soldItem: SoldOrderGoodsItem = {
      id: firstString(row, ["id"]) || `${orderId}-${soldItems.length}`,
      orderId,
      orderNumber: firstString(row, ["orderNumber"]),
      status,
      statusLabel: getOrderStatusLabel(status),
      createTime: firstString(row, ["createTime"]),
      employeeName: firstString(row, ["employeeName"]) || "-",
      payMethod: firstString(row, ["payModeNames"]) || "-",
      goodsName: firstString(row, ["goodsName"]) || "-",
      goodsTypeName: firstString(row, ["goodsTypeName"]) || "-",
      categoryName: firstString(row, ["showCategoryName"]) || "-",
      price: firstNumber(row, ["price"]),
      qty: firstNumber(row, ["qty"]),
      sysMoney: firstNumber(row, ["sysMoney"]),
      discountMoney: firstNumber(row, ["discountMoney"]),
      realMoney: firstNumber(row, ["realMoney"]),
      cancelQty: firstNumber(row, ["cancelQty"]),
      cancelMoney: firstNumber(row, ["cancelMoney"]),
    };
    soldItems.push(soldItem);

    const existing = orderMap.get(orderId);
    if (existing) {
      existing.totalQty += soldItem.qty;
      existing.itemCount += 1;
      existing.sysMoney += soldItem.sysMoney;
      existing.discountMoney += soldItem.discountMoney;
      existing.realMoney += soldItem.realMoney;
      existing.cancelMoney += soldItem.cancelMoney;
    } else {
      orderMap.set(orderId, {
        orderId,
        orderNumber: soldItem.orderNumber,
        status,
        statusLabel: soldItem.statusLabel,
        createTime: soldItem.createTime,
        employeeName: soldItem.employeeName,
        payMethod: soldItem.payMethod,
        terminalName: firstString(row, ["terminalName"]) || "-",
        totalQty: soldItem.qty,
        itemCount: 1,
        sysMoney: soldItem.sysMoney,
        discountMoney: soldItem.discountMoney,
        realMoney: soldItem.realMoney,
        cancelMoney: soldItem.cancelMoney,
      });
    }
  }

  return {
    orders: Array.from(orderMap.values()).sort((a, b) => b.createTime.localeCompare(a.createTime)),
    soldItems: soldItems.sort((a, b) => b.createTime.localeCompare(a.createTime)),
  };
}

function parsePaymentMethodsFromOrders(
  orders: RevenueOrderItem[],
  cashierResponses: JsonRecord[],
): PaymentMethodMetric[] {
  const byMethod = new Map<string, { amount: number; orderIds: Set<string> }>();

  for (const order of orders) {
    const method = normalizePaymentMethod(order.payMethod);
    const current = byMethod.get(method) ?? { amount: 0, orderIds: new Set<string>() };
    current.amount += order.realMoney;
    current.orderIds.add(order.orderId);
    byMethod.set(method, current);
  }

  if (byMethod.size === 0) {
    for (const response of cashierResponses) {
      const totalRow = extractRows(response).find((row) => firstString(row, ["cashierName"]) === "Tong cong") ?? {};
      const cash = firstNumber(totalRow, ["realMoney", "sysMoney"]);
      const transfer = sumDynamicPaymentKeys(totalRow);
      if (cash > 0) byMethod.set("cash", { amount: cash, orderIds: new Set() });
      if (transfer > 0) byMethod.set("transfer", { amount: transfer, orderIds: new Set() });
    }
  }

  const totalAmount = Array.from(byMethod.values()).reduce((sum, item) => sum + item.amount, 0);
  return Array.from(byMethod.entries())
    .map(([method, item]) => ({
      method,
      amount: item.amount,
      orderCount: item.orderIds.size,
      percentage: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
    }))
    .filter((item) => item.amount > 0 || item.orderCount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function buildTopProducts(goodsResponses: JsonRecord[]): TopProductGroup[] {
  const groups = new Map<string, TopProductGroup>();

  for (const response of goodsResponses) {
    for (const groupRow of extractRows(response)) {
      const groupName = firstString(groupRow, ["goodsCategory", "categoryName", "groupName"]) || "Other";
      const goodsItems = Array.isArray(groupRow.goodsItems) ? groupRow.goodsItems.map(asRecord) : [];
      const group = groups.get(groupName) ?? { groupName, quantity: 0, revenue: 0, items: [] };

      for (const row of goodsItems) {
        const productName = firstString(row, ["goodsName", "productName", "name"]) || groupName;
        const quantity = firstNumber(row, ["realQty", "totalQty", "qty", "quantity"]);
        const revenue = firstNumber(row, ["realMoney", "totalRealMoney", "totalMoney", "money"]);
        group.quantity += quantity;
        group.revenue += revenue;
        const existing = group.items.find((item) => item.name === productName);
        if (existing) {
          existing.quantity += quantity;
          existing.revenue += revenue;
        } else {
          group.items.push({ name: productName, quantity, revenue });
        }
      }

      groups.set(groupName, group);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, items: group.items.sort((a, b) => b.revenue - a.revenue).slice(0, 5) }))
    .filter((group) => group.revenue > 0 || group.quantity > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

function buildDeviceConsumptions(statsByDate: Record<string, CoinStat>, days: string[]): DeviceConsumptionItem[] {
  return days.map((date) => {
    const stat = statsByDate[date] ?? emptyCoinStat();
    return {
      date,
      electronicCoinConsum: stat.electronicCoinConsum,
      physicalCoinConsum: stat.physicalCoinConsum,
      totalConsum: stat.electronicCoinConsum + stat.physicalCoinConsum,
      coinGiveQuantity: stat.coinGiveQuantity,
      coinConsumRate: stat.coinConsumRate,
    };
  });
}

function parseCoinStat(response: JsonRecord | undefined): CoinStat {
  const row = extractRows(response ?? {})[0] ?? {};
  return {
    coinSalesAmount: firstNumber(row, ["coinSalesAmount"]),
    coinSalesQuantity: firstNumber(row, ["coinSalesQuantity"]),
    coinGiveQuantity: firstNumber(row, ["coinGiveQuantity"]),
    electronicCoinConsum: firstNumber(row, ["electronicCoinConsum"]),
    physicalCoinConsum: firstNumber(row, ["physicalCoinConsum"]),
    coinConsumRate: firstString(row, ["coinConsumRate"]),
  };
}

function parseLatestMemberSnapshot(response: JsonRecord): MemberSnapshot {
  const rows = extractRows(response)
    .filter((row) => /^\d{4}-\d{2}-\d{2}/.test(firstString(row, ["forDate"])))
    .sort((a, b) => firstString(b, ["forDate"]).localeCompare(firstString(a, ["forDate"])));
  const latest = rows[0] ?? {};
  const latestWithMemberTotal = rows.find((row) => firstNumber(row, ["memberTotal"]) > 0) ?? latest;

  return {
    memberTotal: firstNumber(latestWithMemberTotal, ["memberTotal"]),
    newMemberAmount: firstNumber(latest, ["newMemberAmount"]),
    currency: firstNumber(latest, ["currency"]),
    localCurrency: firstNumber(latest, ["localCurrency"]),
    giftCoins: firstNumber(latest, ["giftCoins"]),
  };
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

function sumCoinStats(statsByDate: Record<string, CoinStat>, days: string[], key: keyof CoinStat): number {
  return days.reduce((sum, day) => {
    const value = statsByDate[day]?.[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

function sumDeviceConsumption(statsByDate: Record<string, CoinStat>, days: string[]): number {
  return days.reduce((sum, day) => {
    const stat = statsByDate[day];
    return sum + (stat ? stat.electronicCoinConsum + stat.physicalCoinConsum : 0);
  }, 0);
}

function uniqueOrderCount(rows: JsonRecord[]): number {
  return new Set(rows.map((row) => firstString(row, ["orderId"])).filter(Boolean)).size;
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
          ? Number(value.replace(/,/g, "").replace(/\s*%$/, ""))
          : 0;
    if (Number.isFinite(numberValue) && numberValue !== 0) return numberValue;
  }
  return 0;
}

function firstString(row: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
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

function normalizePaymentMethod(value: string): string {
  const lower = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("chuyen") || lower.includes("khoan") || lower.includes("transfer") || lower.includes("record")) {
    return "transfer";
  }
  if (lower.includes("cash") || lower.includes("mat") || lower.includes("tien")) {
    return "cash";
  }
  return value || "unknown";
}

function sumDynamicPaymentKeys(row: JsonRecord): number {
  return Object.entries(row).reduce((sum, [key, value]) => {
    if (!key.includes("RealMoney") || key.includes("cash")) return sum;
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
    return sum + (Number.isFinite(numberValue) ? numberValue : 0);
  }, 0);
}

function getOrderStatusLabel(status: number): string {
  if (status === 3) return "Hoan thanh";
  if (status === 4) return "Da huy";
  if (status === 2) return "Da thanh toan";
  if (status === 1) return "Dang xu ly";
  return `Trang thai ${status}`;
}

function emptyCoinStat(): CoinStat {
  return {
    coinSalesAmount: 0,
    coinSalesQuantity: 0,
    coinGiveQuantity: 0,
    electronicCoinConsum: 0,
    physicalCoinConsum: 0,
    coinConsumRate: "",
  };
}

function buildCacheKey(warehouseId: string, mode: RevenueDateMode, range: DateRange): string {
  return `${warehouseId}_${mode}_${range.startDate}_${range.endDate}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function hydrateDashboardRows(
  dashboard: RevenueDashboardData,
  docRef: FirebaseFirestore.DocumentReference,
): Promise<RevenueDashboardData> {
  const [ordersSnap, itemsSnap] = await Promise.all([
    docRef.collection("orders").where("is_deleted", "==", false).get(),
    docRef.collection("sold_items").where("is_deleted", "==", false).get(),
  ]);
  return {
    ...dashboard,
    orders: ordersSnap.docs.map((doc) => doc.data() as RevenueOrderItem),
    soldItems: itemsSnap.docs.map((doc) => doc.data() as SoldOrderGoodsItem),
  };
}

async function writeCollectionRows<T>(
  collectionRef: FirebaseFirestore.CollectionReference,
  rows: T[],
  getId: (row: T) => string,
): Promise<void> {
  const activeIds = new Set(rows.map(getId).filter(Boolean));
  const existing = await collectionRef.get();
  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  for (const row of rows) {
    const id = getId(row);
    if (!id) continue;
    writes.push((batch) => batch.set(collectionRef.doc(id), {
      ...row,
      is_deleted: false,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }));
  }

  for (const doc of existing.docs) {
    if (activeIds.has(doc.id)) continue;
    writes.push((batch) => batch.set(doc.ref, {
      is_deleted: true,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }));
  }

  for (let index = 0; index < writes.length; index += 450) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + 450)) write(batch);
    await batch.commit();
  }
}

function isStale(syncTime: FirebaseFirestore.Timestamp | null): boolean {
  if (!syncTime) return true;
  return Date.now() - syncTime.toMillis() > STALE_THRESHOLD_MS;
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
