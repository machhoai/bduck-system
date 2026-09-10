import type {
  RevenueDailyRow,
  RevenuePaymentCategory,
  TopProductGroup,
} from "@bduck/shared-types";

import type { PosInvoiceOrderRecord } from "../repositories/posInvoiceOrderRepository.js";

const PAID_STATUSES = new Set([
  "LOCAL_PAID",
  "SYNCING",
  "SYNC_FAILED",
  "SYNC_SUCCESS",
]);

type ProductAmount = { quantity: number; revenue: number; taxAmount: number };
export type ProductGroups = Map<
  string,
  ProductAmount & { items: Map<string, ProductAmount> }
>;

export function uniquePaidOrders(
  orders: PosInvoiceOrderRecord[],
): PosInvoiceOrderRecord[] {
  const unique = new Map<string, PosInvoiceOrderRecord>();
  for (const order of orders) {
    if (!PAID_STATUSES.has(order.status)) continue;
    unique.set(`${order.warehouseId}:${order.localOrderId}`, order);
  }
  return [...unique.values()];
}

export function emptyDailyRow(date: string): RevenueDailyRow {
  return {
    date,
    totalRevenue: 0,
    cashRevenue: 0,
    transferRevenue: 0,
    otherRevenue: 0,
    totalTax: 0,
    amountBeforeTax: 0,
    orderCount: 0,
  };
}

export function resolvePosPayment(order: PosInvoiceOrderRecord): {
  method: string;
  category: RevenuePaymentCategory;
} {
  const method =
    text(order.paymentMethodId) ??
    text(order.paymentMethod) ??
    text(order.paymentMethodName) ??
    "OTHER";
  const normalized = normalizeText(method);
  if (/cash|tien mat/u.test(normalized)) return { method, category: "cash" };
  if (/qr|bank|transfer|chuyen khoan/u.test(normalized)) {
    return { method, category: "transfer" };
  }
  return { method, category: "other" };
}

export function orderTaxAmount(order: PosInvoiceOrderRecord): number {
  return (Array.isArray(order.items) ? order.items : []).reduce(
    (sum, rawItem) => {
      const item = asRecord(rawItem);
      const quantity = finiteNumber(item.quantity ?? item.qty);
      return sum + itemTaxAmount(item, quantity);
    },
    0,
  );
}

export function itemTaxAmount(
  item: Record<string, unknown>,
  quantity: number,
): number {
  const explicit = nullableNumber(item.taxAmount ?? item.taxMoney);
  if (explicit !== null) return explicit;
  const gross = nullableNumber(item.price);
  const net = nullableNumber(item.unitPriceBeforeTax);
  return gross !== null && net !== null
    ? Math.max(0, (gross - net) * quantity)
    : 0;
}

export function itemRevenue(
  item: Record<string, unknown>,
  quantity: number,
): number {
  for (const value of [
    item.realMoney,
    item.lineTotal,
    item.totalAmount,
    item.subtotal,
  ]) {
    const parsed = nullableNumber(value);
    if (parsed !== null) return parsed;
  }
  return finiteNumber(item.price ?? item.unitPrice) * quantity;
}

export function addProduct(
  groups: ProductGroups,
  groupName: string,
  productName: string,
  quantity: number,
  revenue: number,
  taxAmount: number,
) {
  const group = groups.get(groupName) ?? {
    quantity: 0,
    revenue: 0,
    taxAmount: 0,
    items: new Map(),
  };
  const product = group.items.get(productName) ?? {
    quantity: 0,
    revenue: 0,
    taxAmount: 0,
  };
  group.quantity += quantity;
  group.revenue += revenue;
  group.taxAmount += taxAmount;
  product.quantity += quantity;
  product.revenue += revenue;
  product.taxAmount += taxAmount;
  group.items.set(productName, product);
  groups.set(groupName, group);
}

export function buildProductGroups(groups: ProductGroups): TopProductGroup[] {
  return [...groups.entries()]
    .map(([groupName, group]) => ({
      groupName,
      quantity: group.quantity,
      revenue: group.revenue,
      taxAmount: group.taxAmount,
      items: [...group.items.entries()]
        .map(([name, item]) => ({ name, ...item }))
        .sort((left, right) => right.revenue - left.revenue),
    }))
    .sort((left, right) => right.revenue - left.revenue);
}

export function vietnamDateKey(value: string): string | null {
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

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function finiteNumber(value: unknown): number {
  return nullableNumber(value) ?? 0;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
}
