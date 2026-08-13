import type {
  PaymentMethodMetric,
  RevenueDashboardData,
  RevenueDashboardFilter,
  RevenueMetric,
} from "@/hooks/useRevenueDashboard";

export const JPOS_REVENUE_PAID_STATUSES = new Set([
  "LOCAL_PAID",
  "SYNCING",
  "SYNC_FAILED",
  "SYNC_SUCCESS",
]);

export interface PosRevenueOrderRecord {
  id: string;
  localOrderId?: unknown;
  hkOrderNumber?: unknown;
  status?: unknown;
  totalAmount?: unknown;
  paidAt?: unknown;
  createdAt?: unknown;
  operatorName?: unknown;
  paymentMethod?: unknown;
  paymentMethodId?: unknown;
  paymentMethodName?: unknown;
  items?: unknown;
}

export interface PosRevenueStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export function aggregatePosRevenueStats(
  records: readonly PosRevenueOrderRecord[],
): PosRevenueStats {
  const paidOrders = getPaidPosOrders(records);

  const totalRevenue = [...paidOrders.values()].reduce(
    (total, order) => total + toFiniteNumber(order.totalAmount),
    0,
  );
  const totalOrders = paidOrders.size;

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
  };
}

export function buildPosRevenueDashboardData(input: {
  records: readonly PosRevenueOrderRecord[];
  warehouseId: string;
  filter: RevenueDashboardFilter;
  range: { startDate: string; endDate: string };
  generatedAt: string;
}): RevenueDashboardData {
  const orders = [...getPaidPosOrders(input.records).values()];
  const summary = aggregatePosRevenueStats(orders);
  const paymentBuckets = new Map<
    string,
    { amount: number; orderCount: number }
  >();
  const timelineBuckets = new Map<
    string,
    { revenue: number; orderCount: number }
  >();
  const productGroups = new Map<
    string,
    {
      quantity: number;
      revenue: number;
      items: Map<string, { quantity: number; revenue: number }>;
    }
  >();

  const granularity = input.filter.mode === "year" ? "month" : "day";

  for (const order of orders) {
    const amount = toFiniteNumber(order.totalAmount);
    const paymentMethod = posPaymentMethod(order);
    const payment = paymentBuckets.get(paymentMethod) ?? {
      amount: 0,
      orderCount: 0,
    };
    payment.amount += amount;
    payment.orderCount += 1;
    paymentBuckets.set(paymentMethod, payment);

    const paidAt = text(order.paidAt) ?? text(order.createdAt);
    const businessDate = paidAt ? vietnamDateKey(paidAt) : null;
    if (businessDate) {
      const key = granularity === "month" ? businessDate.slice(0, 7) : businessDate;
      const point = timelineBuckets.get(key) ?? { revenue: 0, orderCount: 0 };
      point.revenue += amount;
      point.orderCount += 1;
      timelineBuckets.set(key, point);
    }

    for (const rawItem of Array.isArray(order.items) ? order.items : []) {
      const item = asRecord(rawItem);
      const name = text(item.goodsName) ?? text(item.name) ?? "Sản phẩm";
      const groupName =
        text(item.categoryName) ?? text(item.goodsTypeName) ?? "Khác";
      const quantity = toFiniteNumber(item.quantity ?? item.qty);
      const revenue = itemRevenue(item, quantity);
      const group = productGroups.get(groupName) ?? {
        quantity: 0,
        revenue: 0,
        items: new Map(),
      };
      const product = group.items.get(name) ?? { quantity: 0, revenue: 0 };
      product.quantity += quantity;
      product.revenue += revenue;
      group.quantity += quantity;
      group.revenue += revenue;
      group.items.set(name, product);
      productGroups.set(groupName, group);
    }
  }

  const paymentMethods: PaymentMethodMetric[] = [...paymentBuckets.entries()]
    .map(([method, value]) => ({
      method,
      amount: value.amount,
      orderCount: value.orderCount,
      percentage:
        summary.totalRevenue > 0
          ? (value.amount / summary.totalRevenue) * 100
          : 0,
    }))
    .sort((left, right) => right.amount - left.amount);

  const metric = (value: number): RevenueMetric => ({
    value,
    previousValue: 0,
    changePercent: 0,
  });

  return {
    warehouseId: input.warehouseId,
    warehouseName: "",
    mode: input.filter.mode,
    cacheKey: `jpos_${input.warehouseId}_${input.range.startDate}_${input.range.endDate}`,
    range: {
      ...input.range,
      label:
        input.range.startDate === input.range.endDate
          ? displayDate(input.range.startDate)
          : `${displayDate(input.range.startDate)} - ${displayDate(input.range.endDate)}`,
      highlightedDates: [],
    },
    comparisonLabel: "",
    stats: {
      totalRevenue: metric(summary.totalRevenue),
      totalOrders: metric(summary.totalOrders),
      averageOrderValue: metric(summary.averageOrderValue),
      memberCardSales: metric(0),
      deviceConsumption: metric(0),
      memberCount: metric(0),
      memberStoredBalance: metric(0),
      memberGiftBalance: metric(0),
      paymentMethods,
    },
    charts: {
      granularity,
      points: [...timelineBuckets.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => ({
          key,
          label:
            granularity === "month"
              ? `${key.slice(5, 7)}/${key.slice(0, 4)}`
              : `${key.slice(8, 10)}/${key.slice(5, 7)}`,
          revenue: value.revenue,
          orderCount: value.orderCount,
          memberCardAmount: 0,
          highlighted: false,
        })),
      paymentMethods,
      memberCardSales: [],
    },
    topProductGroups: [...productGroups.entries()]
      .map(([groupName, group]) => ({
        groupName,
        quantity: group.quantity,
        revenue: group.revenue,
        items: [...group.items.entries()]
          .map(([name, item]) => ({ name, ...item }))
          .sort((left, right) => right.revenue - left.revenue),
      }))
      .sort((left, right) => right.revenue - left.revenue),
    deviceConsumptions: [],
    orders: orders.map((order) => ({
      orderId: order.id,
      orderNumber: text(order.hkOrderNumber) ?? text(order.localOrderId) ?? order.id,
      status: 3,
      statusLabel: "Đã thanh toán",
      createTime: text(order.paidAt) ?? text(order.createdAt) ?? "",
      employeeName: text(order.operatorName) ?? "JPOS",
      payMethod: posPaymentMethod(order),
      terminalName: "JPOS",
      totalQty: orderQuantity(order),
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      sysMoney: toFiniteNumber(order.totalAmount),
      discountMoney: 0,
      realMoney: toFiniteNumber(order.totalAmount),
      cancelMoney: 0,
    })),
    soldItems: [],
    generatedAt: input.generatedAt,
  };
}

export function toVietnamIsoRange(range: {
  startDate: string;
  endDate: string;
}): { startIso: string; endExclusiveIso: string } {
  const start = new Date(`${range.startDate}T00:00:00+07:00`);
  const end = new Date(`${range.endDate}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    endExclusiveIso: end.toISOString(),
  };
}

function getPaidPosOrders(
  records: readonly PosRevenueOrderRecord[],
): Map<string, PosRevenueOrderRecord> {
  const paidOrders = new Map<string, PosRevenueOrderRecord>();
  for (const record of records) {
    if (
      typeof record.status !== "string" ||
      !JPOS_REVENUE_PAID_STATUSES.has(record.status) ||
      !Number.isFinite(Number(record.totalAmount))
    ) {
      continue;
    }
    const localOrderId = text(record.localOrderId) ?? record.id;
    paidOrders.set(localOrderId, record);
  }
  return paidOrders;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemRevenue(item: Record<string, unknown>, quantity: number): number {
  for (const candidate of [
    item.realMoney,
    item.lineTotal,
    item.totalAmount,
    item.subtotal,
  ]) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return toFiniteNumber(item.price ?? item.unitPrice) * quantity;
}

function posPaymentMethod(order: PosRevenueOrderRecord): string {
  return (
    text(order.paymentMethodId) ??
    text(order.paymentMethod) ??
    text(order.paymentMethodName) ??
    "OTHER"
  );
}

function orderQuantity(order: PosRevenueOrderRecord): number {
  return (Array.isArray(order.items) ? order.items : []).reduce(
    (total, rawItem) => {
      const item = asRecord(rawItem);
      return total + toFiniteNumber(item.quantity ?? item.qty);
    },
    0,
  );
}

function vietnamDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function displayDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : value;
}
