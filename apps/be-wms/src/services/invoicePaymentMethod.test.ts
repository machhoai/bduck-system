import assert from "node:assert/strict";
import test from "node:test";

import type { PosInvoiceOrderRecord } from "../repositories/posInvoiceOrderRepository.js";

import {
  resolveInvoiceSourcePaymentMethod,
  resolvePosOrderPaymentMethod,
} from "./invoicePaymentMethod.js";

const posOrder = (payment: Record<string, unknown>): PosInvoiceOrderRecord =>
  ({
    localOrderId: "local-order-1",
    hkOrderNumber: "HK-1",
    warehouseId: "warehouse-1",
    status: "SYNC_SUCCESS",
    totalAmount: 100_000,
    items: [],
    createdAt: "2026-08-13T01:00:00.000Z",
    ...payment,
  }) as PosInvoiceOrderRecord;

test("JPOS-linked invoices use the local payment method instead of the OpenAPI default", () => {
  const order = posOrder({
    paymentMethodName: "Chuyển khoản",
    paymentMethodId: "BANK_TRANSFER",
  });

  assert.equal(
    resolveInvoiceSourcePaymentMethod("Tiền mặt", order),
    "Chuyển khoản",
  );
});

test("JPOS payment method falls back to local id and legacy value", () => {
  assert.equal(
    resolvePosOrderPaymentMethod(
      posOrder({ paymentMethodId: "BANK_TRANSFER" }),
    ),
    "BANK_TRANSFER",
  );
  assert.equal(
    resolvePosOrderPaymentMethod(posOrder({ paymentMethod: "CARD" })),
    "CARD",
  );
});

test("JPOS-linked invoices do not reuse an incorrect OpenAPI payment method when local data is missing", () => {
  assert.equal(
    resolveInvoiceSourcePaymentMethod("Tiền mặt", posOrder({})),
    null,
  );
});

test("JoyWorld invoices continue to use the OpenAPI payment method", () => {
  assert.equal(
    resolveInvoiceSourcePaymentMethod("  Tiền mặt  ", null),
    "Tiền mặt",
  );
});
