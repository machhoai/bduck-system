import type { PosInvoiceOrderRecord } from "../repositories/posInvoiceOrderRepository.js";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const resolvePosOrderPaymentMethod = (
  order: PosInvoiceOrderRecord,
): string | null =>
  text(order.paymentMethodName) ??
  text(order.paymentMethodId) ??
  text(order.paymentMethod);

export const resolveInvoiceSourcePaymentMethod = (
  openApiPaymentMethod: unknown,
  linkedPosOrder: PosInvoiceOrderRecord | null,
): string | null =>
  linkedPosOrder
    ? resolvePosOrderPaymentMethod(linkedPosOrder)
    : text(openApiPaymentMethod);
