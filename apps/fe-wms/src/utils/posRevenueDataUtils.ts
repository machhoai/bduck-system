import type { RevenuePaymentCategory } from "@bduck/shared-types";

export const JPOS_REVENUE_PAID_STATUSES = new Set([
  "LOCAL_PAID",
  "SYNCING",
  "SYNC_FAILED",
  "SYNC_SUCCESS",
]);

export interface PosRevenueOrderRecord {
  id: string;
  warehouseId?: unknown;
  localOrderId?: unknown;
  hkOrderNumber?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  syncStatus?: unknown;
  totalAmount?: unknown;
  paidAt?: unknown;
  createdAt?: unknown;
  operatorName?: unknown;
  paymentMethod?: unknown;
  paymentMethodId?: unknown;
  paymentMethodName?: unknown;
  items?: unknown;
  voucherDiscount?: unknown;
  deviceName?: unknown;
}

export interface PosRevenueStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export function aggregatePosRevenueStats(
  records: readonly PosRevenueOrderRecord[],
): PosRevenueStats {
  const orders = getPaidPosOrders(records);
  const totalRevenue = [...orders.values()].reduce(
    (sum, order) => sum + toFiniteNumber(order.totalAmount),
    0,
  );
  const totalOrders = orders.size;
  return {
    totalRevenue,
    totalOrders,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
  };
}

export function getPaidPosOrders(
  records: readonly PosRevenueOrderRecord[],
): Map<string, PosRevenueOrderRecord> {
  const paidOrders = new Map<string, PosRevenueOrderRecord>();
  for (const record of records) {
    if (
      !isPosOrderRevenueEligible(record) ||
      !Number.isFinite(Number(record.totalAmount))
    ) {
      continue;
    }
    const localOrderId = text(record.localOrderId) ?? record.id;
    const warehouseId = text(record.warehouseId);
    paidOrders.set(warehouseId ? `${warehouseId}:${localOrderId}` : localOrderId, record);
  }
  return paidOrders;
}

export function isPosOrderRevenueEligible(
  order: PosRevenueOrderRecord,
): boolean {
  if (order.syncStatus === "CANCELLED") return false;
  if (typeof order.paymentStatus === "string") {
    return order.paymentStatus !== "DRAFT" &&
      order.paymentStatus !== "REFUNDED";
  }
  return typeof order.status === "string" &&
    JPOS_REVENUE_PAID_STATUSES.has(order.status);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function itemRevenue(item: Record<string, unknown>, quantity: number) {
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

export function posPaymentMethod(order: PosRevenueOrderRecord): string {
  return (
    text(order.paymentMethodId) ??
    text(order.paymentMethod) ??
    text(order.paymentMethodName) ??
    "OTHER"
  );
}

export function posPaymentCategory(method: string): RevenuePaymentCategory {
  const normalized = method
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
  if (/cash|tien mat/u.test(normalized)) return "cash";
  return /qr|bank|transfer|chuyen khoan/u.test(normalized)
    ? "transfer"
    : "other";
}

export function orderTaxAmount(order: PosRevenueOrderRecord): number {
  return (Array.isArray(order.items) ? order.items : []).reduce((sum, rawItem) => {
    const item = asRecord(rawItem);
    return sum + itemTaxAmount(item, toFiniteNumber(item.quantity ?? item.qty));
  }, 0);
}

export function itemTaxAmount(
  item: Record<string, unknown>,
  quantity: number,
): number {
  const explicit = Number(item.taxAmount ?? item.taxMoney);
  if (Number.isFinite(explicit)) return explicit;
  const gross = Number(item.price);
  const net = Number(item.unitPriceBeforeTax);
  return Number.isFinite(gross) && Number.isFinite(net)
    ? Math.max(0, (gross - net) * quantity)
    : 0;
}

export function orderQuantity(order: PosRevenueOrderRecord): number {
  return (Array.isArray(order.items) ? order.items : []).reduce(
    (total, rawItem) => {
      const item = asRecord(rawItem);
      return total + toFiniteNumber(item.quantity ?? item.qty);
    },
    0,
  );
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

export function displayDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : value;
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
