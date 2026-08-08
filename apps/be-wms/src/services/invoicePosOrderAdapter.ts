import { createHash } from "node:crypto";
import type {
  InvoiceSkuMapping,
  InvoiceSourceOrderLine,
  InvoiceVatRateName,
  MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import type { SourceOrderWrite } from "../repositories/invoiceOrderRepository.js";
import type {
  PosInvoiceOrderRecord,
} from "../repositories/posInvoiceOrderRepository.js";
import type {
  StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import {
  calculateInvoice,
  INVOICE_CALCULATION_VERSION,
} from "./invoiceCalculationService.js";
import { normalizeVatRateName } from "./invoiceOrderAdapter.js";
import { invoiceLineShouldAppearInIssuedInvoice } from "./invoiceLineVisibilityPolicy.js";
import { preflightInvoiceSourceOrder } from "./invoicePreflightService.js";
import { canonicalJson, parseJoyworldDate } from "./invoiceOrderSyncUtils.js";

const MAPPING_VERSION = "jpos-meinvoice-v1";
const PAID_STATUSES = new Set([
  "LOCAL_PAID",
  "SYNCING",
  "SYNC_FAILED",
  "SYNC_SUCCESS",
]);

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const number = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveVatRate = (
  item: Record<string, unknown>,
  mapping: InvoiceSkuMapping | undefined,
  config: MeInvoiceStoreConfig | null,
): InvoiceVatRateName | null => {
  if (config?.tax_rate_source === "SKU") {
    return mapping?.vat_rate_name ?? config.default_vat_rate_name;
  }
  return normalizeVatRateName(item.taxRate)
    ?? mapping?.vat_rate_name
    ?? config?.default_vat_rate_name
    ?? null;
};

const normalizeItems = (
  order: PosInvoiceOrderRecord,
  config: MeInvoiceStoreConfig | null,
): InvoiceSourceOrderLine[] =>
  (Array.isArray(order.items) ? order.items : []).map((item, index) => {
    const goodsId = text(item.goodsId);
    const mapping = goodsId ? config?.sku_mapping[goodsId] : undefined;
    const quantity = number(item.quantity);
    const grossUnitPrice = number(item.price);
    const netUnitPrice = number(item.unitPriceBeforeTax);
    const vatRateName = resolveVatRate(item, mapping, config);
    const sourceTotal =
      grossUnitPrice !== null && quantity !== null
        ? grossUnitPrice * quantity
        : null;
    const sourceBeforeTax =
      netUnitPrice !== null && quantity !== null
        ? netUnitPrice * quantity
        : null;
    const sourceVat = number(item.taxAmount)
      ?? (sourceTotal !== null && sourceBeforeTax !== null
        ? sourceTotal - sourceBeforeTax
        : null);

    return {
      line_number: index + 1,
      source_item_id: goodsId,
      item_code: mapping?.item_code ?? goodsId,
      item_name: mapping?.item_name ?? text(item.goodsName),
      category_code: null,
      category_name: null,
      unit_name: mapping?.unit_name ?? config?.default_unit_name ?? null,
      quantity,
      unit_price:
        config?.price_includes_vat === false
          ? netUnitPrice ?? grossUnitPrice
          : grossUnitPrice,
      discount_rate: null,
      discount_amount: null,
      vat_rate_name: vatRateName,
      vat_rate:
        vatRateName && /^\d+%$/.test(vatRateName)
          ? Number(vatRateName.slice(0, -1))
          : 0,
      source_amount_without_vat: sourceBeforeTax,
      source_vat_amount: sourceVat,
      source_total_amount: sourceTotal,
    };
  });

const safeRawItem = (item: Record<string, unknown>) => ({
  goodsId: text(item.goodsId),
  goodsName: text(item.goodsName),
  price: number(item.price),
  quantity: number(item.quantity),
  unitPriceBeforeTax: number(item.unitPriceBeforeTax),
  taxRate: number(item.taxRate),
  taxAmount: number(item.taxAmount),
});

const safeRawOrder = (order: PosInvoiceOrderRecord) => ({
  localOrderId: order.localOrderId,
  hkOrderNumber: order.hkOrderNumber ?? null,
  warehouseId: order.warehouseId,
  shopId: number(order.shopId),
  status: order.status,
  paymentMethod: text(order.paymentMethod),
  paymentMethodId: text(order.paymentMethodId),
  paymentMethodName: text(order.paymentMethodName),
  totalAmount: number(order.totalAmount),
  items: (Array.isArray(order.items) ? order.items : []).map(safeRawItem),
  customerName: text(order.customerName),
  customerPhone: text(order.customerPhone),
  createdAt: order.createdAt,
  paidAt: text(order.paidAt),
  updatedAt: text(order.updatedAt),
});

export const posOrderIsPaid = (order: PosInvoiceOrderRecord): boolean =>
  PAID_STATUSES.has(order.status) && Boolean(text(order.paidAt));

export const buildPosInvoiceSourceOrder = (
  order: PosInvoiceOrderRecord,
  businessDate: string,
  config: MeInvoiceStoreConfig | null,
  account: StoredMeInvoiceAccount | null,
): SourceOrderWrite => {
  const normalizedItems = normalizeItems(order, config);
  const invoiceItems = normalizedItems.filter(
    invoiceLineShouldAppearInIssuedInvoice,
  );
  const calculation =
    config?.price_includes_vat === null ||
      config?.price_includes_vat === undefined
      ? null
      : calculateInvoice(
          invoiceItems,
          config.price_includes_vat,
          config.option_user_defined,
        );
  const paymentTime = text(order.paidAt);
  const taxMoney = normalizedItems.reduce(
    (total, item) => total + (item.source_vat_amount ?? 0),
    0,
  );
  const totalAmount = number(order.totalAmount);
  const paymentMethod =
    text(order.paymentMethodName) ?? text(order.paymentMethodId);
  const mappedPaymentMethod = paymentMethod
    ? config?.payment_method_mapping[paymentMethod]
      ?? config?.default_payment_method_name
      ?? paymentMethod
    : config?.default_payment_method_name ?? null;
  const preflight = preflightInvoiceSourceOrder({
    lines: normalizedItems,
    calculation,
    payment_time: parseJoyworldDate(paymentTime),
    mapped_payment_method: mappedPaymentMethod,
    store_config_exists: Boolean(config),
    store_config_enabled: config?.enabled === true,
    price_includes_vat: config?.price_includes_vat ?? null,
    inv_series: config?.inv_series ?? null,
    go_live_at: config?.go_live_at ?? null,
    account_exists: Boolean(account),
    account_enabled: account?.enabled === true,
    account_last_test_succeeded: account?.last_test_succeeded === true,
  });
  const rawOrder = safeRawOrder(order);

  return {
    source_order_id: order.localOrderId,
    source_payload_hash: createHash("sha256")
      .update(canonicalJson(rawOrder))
      .digest("hex"),
    raw_payload: { pos_order: rawOrder },
    projection: {
      warehouse_id: order.warehouseId,
      source_system: "JPOS",
      source_order_id: order.localOrderId,
      local_order_id: order.localOrderId,
      hk_order_number: text(order.hkOrderNumber),
      pos_order_status: order.status,
      business_date: businessDate,
      source_create_time: text(order.createdAt),
      payment_time: paymentTime,
      source_action_time: parseJoyworldDate(paymentTime ?? order.createdAt),
      source_status: 3,
      order_number: text(order.hkOrderNumber) ?? order.localOrderId,
      customer_name: text(order.customerName),
      payment_method: paymentMethod,
      mapped_payment_method: mappedPaymentMethod,
      original_money: totalAmount,
      system_money: totalAmount,
      discount_money: number(order.voucherDiscount) ?? 0,
      real_money: totalAmount,
      cancel_money: 0,
      tax_money: taxMoney,
      amount_before_tax:
        totalAmount === null ? null : totalAmount - taxMoney,
      item_count: normalizedItems.length,
      normalized_items: normalizedItems,
      calculation,
      preflight,
      mapping_version: MAPPING_VERSION,
      calculation_version: INVOICE_CALCULATION_VERSION,
      customer_invoice_request_status: "AVAILABLE",
      customer_invoice_request_submitted_at: null,
    },
  };
};
