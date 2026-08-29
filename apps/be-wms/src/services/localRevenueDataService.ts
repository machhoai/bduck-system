import type {
  PaymentMethodMetric,
  RevenueDailyRow,
  RevenueOrderItem,
  RevenuePaymentCategory,
  SoldOrderGoodsItem,
  TopProductGroup,
} from "@bduck/shared-types";

import { posInvoiceOrderRepository } from "../repositories/posInvoiceOrderRepository.js";

import {
  addProduct,
  asRecord,
  buildProductGroups,
  emptyDailyRow,
  finiteNumber,
  itemRevenue,
  itemTaxAmount,
  orderTaxAmount,
  resolvePosPayment,
  text,
  uniquePaidOrders,
  vietnamDateKey,
  type ProductGroups,
} from "./localRevenueDataUtils.js";
import {
  daysBetween,
  toVietnamIsoRange,
  type RevenueDateRange,
} from "./revenueDateRange.js";

export interface RevenuePeriodData {
  dailyRows: RevenueDailyRow[];
  paymentMethods: PaymentMethodMetric[];
  topProductGroups: TopProductGroup[];
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
}

export async function loadLocalRevenuePeriod(
  warehouseId: string,
  range: RevenueDateRange,
): Promise<RevenuePeriodData> {
  const { startIso, endExclusiveIso } = toVietnamIsoRange(range);
  const sourceOrders = await posInvoiceOrderRepository.listPaidForDate(
    warehouseId,
    startIso,
    endExclusiveIso,
  );
  const orders = uniquePaidOrders(sourceOrders);
  const daily = new Map(
    daysBetween(range.startDate, range.endDate).map((date) => [
      date,
      emptyDailyRow(date),
    ]),
  );
  const payments = new Map<
    string,
    { category: RevenuePaymentCategory; amount: number; orderCount: number }
  >();
  const products: ProductGroups = new Map();
  const dashboardOrders: RevenueOrderItem[] = [];
  const soldItems: SoldOrderGoodsItem[] = [];

  for (const order of orders) {
    const businessDate = vietnamDateKey(order.paidAt ?? order.createdAt);
    const row = businessDate ? daily.get(businessDate) : undefined;
    if (!row) continue;

    const totalRevenue = finiteNumber(order.totalAmount);
    const taxAmount = orderTaxAmount(order);
    const payment = resolvePosPayment(order);
    row.totalRevenue += totalRevenue;
    row.totalTax += taxAmount;
    row.amountBeforeTax += totalRevenue - taxAmount;
    row.orderCount += 1;
    if (payment.category === "cash") row.cashRevenue += totalRevenue;
    else if (payment.category === "transfer") row.transferRevenue += totalRevenue;
    else row.otherRevenue += totalRevenue;

    const paymentBucket = payments.get(payment.method) ?? {
      category: payment.category,
      amount: 0,
      orderCount: 0,
    };
    paymentBucket.amount += totalRevenue;
    paymentBucket.orderCount += 1;
    payments.set(payment.method, paymentBucket);

    const orderId = text(order.localOrderId) ?? "";
    const orderNumber = text(order.hkOrderNumber) ?? orderId;
    const orderItems = Array.isArray(order.items) ? order.items : [];
    let totalQuantity = 0;
    orderItems.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      const quantity = finiteNumber(item.quantity ?? item.qty);
      const revenue = itemRevenue(item, quantity);
      const itemTax = itemTaxAmount(item, quantity);
      const productName = text(item.goodsName) ?? text(item.name) ?? "Product";
      const groupName =
        text(item.categoryName) ?? text(item.goodsTypeName) ?? "Other";
      totalQuantity += quantity;
      addProduct(products, groupName, productName, quantity, revenue, itemTax);
      soldItems.push({
        id: `${orderId}-${text(item.goodsId) ?? index}`,
        orderId,
        orderNumber,
        status: 3,
        statusLabel: "PAID",
        createTime: text(order.paidAt) ?? text(order.createdAt) ?? "",
        employeeName: text(order.operatorName) ?? "JPOS",
        payMethod: payment.method,
        goodsName: productName,
        goodsTypeName: groupName,
        categoryName: groupName,
        price: finiteNumber(item.price ?? item.unitPrice),
        qty: quantity,
        sysMoney: revenue,
        discountMoney: 0,
        realMoney: revenue,
        cancelQty: 0,
        cancelMoney: 0,
        taxMoney: itemTax,
      });
    });

    dashboardOrders.push({
      orderId,
      orderNumber,
      status: 3,
      statusLabel: "PAID",
      createTime: text(order.paidAt) ?? text(order.createdAt) ?? "",
      employeeName: text(order.operatorName) ?? "JPOS",
      payMethod: payment.method,
      terminalName: text(order.deviceName) ?? "JPOS",
      totalQty: totalQuantity,
      itemCount: orderItems.length,
      sysMoney: totalRevenue,
      discountMoney: finiteNumber(order.voucherDiscount),
      realMoney: totalRevenue,
      cancelMoney: 0,
      taxMoney: taxAmount,
    });
  }

  const totalRevenue = [...daily.values()].reduce(
    (sum, row) => sum + row.totalRevenue,
    0,
  );
  return {
    dailyRows: [...daily.values()],
    paymentMethods: [...payments.entries()]
      .map(([method, value]) => ({
        method,
        ...value,
        percentage:
          totalRevenue > 0 ? (value.amount / totalRevenue) * 100 : 0,
      }))
      .sort((left, right) => right.amount - left.amount),
    topProductGroups: buildProductGroups(products),
    orders: dashboardOrders.sort((left, right) =>
      right.createTime.localeCompare(left.createTime),
    ),
    soldItems: soldItems.sort((left, right) =>
      right.createTime.localeCompare(left.createTime),
    ),
  };
}

export async function loadLocalTaxByDate(
  warehouseId: string,
  range: RevenueDateRange,
): Promise<Record<string, number>> {
  const period = await loadLocalRevenuePeriod(warehouseId, range);
  return Object.fromEntries(period.dailyRows.map((row) => [row.date, row.totalTax]));
}
