import type {
  PaymentMethodMetric,
  RevenueDashboardData,
  RevenueDashboardFilter,
  RevenueMetric,
  RevenuePaymentCategory,
} from "@/hooks/useRevenueDashboard";

import {
  aggregatePosRevenueStats,
  asRecord,
  displayDate,
  getPaidPosOrders,
  itemRevenue,
  itemTaxAmount,
  orderQuantity,
  orderTaxAmount,
  posPaymentCategory,
  posPaymentMethod,
  text,
  toFiniteNumber,
  vietnamDateKey,
  type PosRevenueOrderRecord,
} from "./posRevenueDataUtils";

export {
  aggregatePosRevenueStats,
  JPOS_REVENUE_PAID_STATUSES,
  toVietnamIsoRange,
  type PosRevenueOrderRecord,
  type PosRevenueStats,
} from "./posRevenueDataUtils";

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
    { category: RevenuePaymentCategory; amount: number; orderCount: number }
  >();
  const timelineBuckets = new Map<
    string,
    {
      revenue: number;
      cashRevenue: number;
      transferRevenue: number;
      otherRevenue: number;
      taxAmount: number;
      orderCount: number;
    }
  >();
  const productGroups = new Map<
    string,
    {
      quantity: number;
      revenue: number;
      taxAmount: number;
      items: Map<string, { quantity: number; revenue: number; taxAmount: number }>;
    }
  >();

  const granularity = input.filter.mode === "year" ? "month" : "day";

  for (const order of orders) {
    const amount = toFiniteNumber(order.totalAmount);
    const paymentMethod = posPaymentMethod(order);
    const paymentCategory = posPaymentCategory(paymentMethod);
    const payment = paymentBuckets.get(paymentMethod) ?? {
      category: paymentCategory,
      amount: 0,
      orderCount: 0,
    };
    payment.amount += amount;
    payment.orderCount += 1;
    paymentBuckets.set(paymentMethod, payment);

    const paidAt = text(order.paidAt) ?? text(order.createdAt);
    const businessDate = paidAt ? vietnamDateKey(paidAt) : null;
    if (businessDate) {
      const key = businessDate;
      const point = timelineBuckets.get(key) ?? {
        revenue: 0,
        cashRevenue: 0,
        transferRevenue: 0,
        otherRevenue: 0,
        taxAmount: 0,
        orderCount: 0,
      };
      point.revenue += amount;
      if (paymentCategory === "cash") point.cashRevenue += amount;
      else if (paymentCategory === "transfer") point.transferRevenue += amount;
      else point.otherRevenue += amount;
      point.taxAmount += orderTaxAmount(order);
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
      const taxAmount = itemTaxAmount(item, quantity);
      const group = productGroups.get(groupName) ?? {
        quantity: 0,
        revenue: 0,
        taxAmount: 0,
        items: new Map(),
      };
      const product = group.items.get(name) ?? {
        quantity: 0,
        revenue: 0,
        taxAmount: 0,
      };
      product.quantity += quantity;
      product.revenue += revenue;
      product.taxAmount += taxAmount;
      group.quantity += quantity;
      group.revenue += revenue;
      group.taxAmount += taxAmount;
      group.items.set(name, product);
      productGroups.set(groupName, group);
    }
  }

  const paymentMethods: PaymentMethodMetric[] = [...paymentBuckets.entries()]
    .map(([method, value]) => ({
      method,
      category: value.category,
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
  const totalTax = orders.reduce((sum, order) => sum + orderTaxAmount(order), 0);
  const paymentTotal = (category: RevenuePaymentCategory) =>
    paymentMethods
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + item.amount, 0);

  const dailyRows = [...timelineBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date,
      totalRevenue: value.revenue,
      cashRevenue: value.cashRevenue,
      transferRevenue: value.transferRevenue,
      otherRevenue: value.otherRevenue,
      totalTax: value.taxAmount,
      amountBeforeTax: Math.max(0, value.revenue - value.taxAmount),
      orderCount: value.orderCount,
  }));
  const chartBuckets = new Map<string, { revenue: number; orderCount: number }>();
  buildTimelineKeys(input.range, granularity).forEach((key) => {
    chartBuckets.set(key, { revenue: 0, orderCount: 0 });
  });
  dailyRows.forEach((row) => {
    const key = granularity === "month" ? row.date.slice(0, 7) : row.date;
    const point = chartBuckets.get(key) ?? { revenue: 0, orderCount: 0 };
    point.revenue += row.totalRevenue;
    point.orderCount += row.orderCount;
    chartBuckets.set(key, point);
  });

  return {
    source: "LOCAL_POS",
    taxSource: "LOCAL_POS",
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
      cashRevenue: metric(paymentTotal("cash")),
      transferRevenue: metric(paymentTotal("transfer")),
      otherRevenue: metric(paymentTotal("other")),
      totalTax: metric(totalTax),
      amountBeforeTax: metric(Math.max(0, summary.totalRevenue - totalTax)),
      totalOrders: metric(summary.totalOrders),
      averageOrderValue: metric(summary.averageOrderValue),
      memberCardSales: metric(0),
      deviceConsumption: metric(0),
      memberCount: metric(0),
      memberStoredBalance: metric(0),
      memberGiftBalance: metric(0),
      paymentMethods,
    },
    dailyRows,
    charts: {
      granularity,
      points: [...chartBuckets.entries()]
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
      taxAmount: group.taxAmount,
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
      taxMoney: orderTaxAmount(order),
    })),
    soldItems: orders.flatMap((order) => {
      const orderId = text(order.localOrderId) ?? order.id;
      const orderNumber = text(order.hkOrderNumber) ?? orderId;
      return (Array.isArray(order.items) ? order.items : []).map((rawItem, index) => {
        const item = asRecord(rawItem);
        const quantity = toFiniteNumber(item.quantity ?? item.qty);
        const groupName = text(item.categoryName) ?? text(item.goodsTypeName) ?? "Other";
        return {
          id: `${orderId}-${text(item.goodsId) ?? index}`,
          orderId,
          orderNumber,
          status: 3,
          statusLabel: "PAID",
          createTime: text(order.paidAt) ?? text(order.createdAt) ?? "",
          employeeName: text(order.operatorName) ?? "JPOS",
          payMethod: posPaymentMethod(order),
          goodsName: text(item.goodsName) ?? text(item.name) ?? "Product",
          goodsTypeName: groupName,
          categoryName: groupName,
          price: toFiniteNumber(item.price ?? item.unitPrice),
          qty: quantity,
          sysMoney: itemRevenue(item, quantity),
          discountMoney: 0,
          realMoney: itemRevenue(item, quantity),
          cancelQty: 0,
          cancelMoney: 0,
          taxMoney: itemTaxAmount(item, quantity),
        };
      });
    }),
    generatedAt: input.generatedAt,
  };
}

function buildTimelineKeys(
  range: { startDate: string; endDate: string },
  granularity: "day" | "month",
) {
  const startDate =
    range.startDate <= range.endDate ? range.startDate : range.endDate;
  const endDate =
    range.startDate <= range.endDate ? range.endDate : range.startDate;

  if (granularity === "month") {
    const keys: string[] = [];
    const endMonth = endDate.slice(0, 7);
    let currentMonth = startDate.slice(0, 7);
    while (currentMonth <= endMonth) {
      keys.push(currentMonth);
      const [year, month] = currentMonth.split("-").map(Number);
      const nextMonth = new Date(Date.UTC(year, month, 1));
      currentMonth = nextMonth.toISOString().slice(0, 7);
    }
    return keys;
  }

  const keys: string[] = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    keys.push(currentDate);
    const nextDate = new Date(`${currentDate}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    currentDate = nextDate.toISOString().slice(0, 10);
  }
  return keys;
}
