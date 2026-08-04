import assert from "node:assert/strict";
import test from "node:test";
import type { PosInvoiceOrderRecord } from "../repositories/posInvoiceOrderRepository.js";
import {
  customerInvoiceRequestSubmissionSchema,
  invoiceRequestTokenSchema,
  taxCodeSchema,
} from "./customerInvoiceRequestSchemas.js";
import {
  buildPosInvoiceSourceOrder,
  posOrderIsPaid,
} from "./invoicePosOrderAdapter.js";
import { lookupVietQrTaxCode } from "./vietQrTaxLookupService.js";

const paidOrder = (overrides: Partial<PosInvoiceOrderRecord> = {}) =>
  ({
    localOrderId: "local-20260804-001",
    hkOrderNumber: null,
    warehouseId: "warehouse-1",
    status: "LOCAL_PAID",
    totalAmount: 110_000,
    items: [
      {
        goodsId: "duck-001",
        goodsName: "Vịt quay",
        quantity: 1,
        price: 110_000,
        unitPriceBeforeTax: 100_000,
        taxAmount: 10_000,
        taxRate: 10,
      },
    ],
    paidAt: "2026-08-04T03:30:00.000Z",
    createdAt: "2026-08-04T03:00:00.000Z",
    ...overrides,
  }) as PosInvoiceOrderRecord;

test("public request schemas only accept opaque tokens, complete tax codes and valid buyer data", () => {
  assert.equal(invoiceRequestTokenSchema.safeParse("a".repeat(43)).success, true);
  assert.equal(invoiceRequestTokenSchema.safeParse("local-20260804-001").success, false);
  assert.equal(taxCodeSchema.safeParse("0312345678").success, true);
  assert.equal(taxCodeSchema.safeParse("0312345678-001").success, true);
  assert.equal(taxCodeSchema.safeParse("031234").success, false);
  assert.equal(
    customerInvoiceRequestSubmissionSchema.safeParse({
      idempotency_key: "f7d22cb8-9ba7-4a5b-b588-37ce672dc36f",
      action_time: "2026-08-04T10:30:00.000+07:00",
      buyer: {
        full_name: "",
        legal_name: "Công ty TNHH Vịt Vàng",
        tax_code: "0312345678",
        address: "Thành phố Hồ Chí Minh",
        phone_number: "0901 234 567",
        email: "invoice@example.com",
      },
    }).success,
    true,
  );
});

test("LOCAL_PAID JPOS orders stay addressable by local id before HK sync", () => {
  const order = paidOrder();
  assert.equal(posOrderIsPaid(order), true);

  const source = buildPosInvoiceSourceOrder(order, "2026-08-04", null, null);
  assert.equal(source.source_order_id, order.localOrderId);
  assert.equal(source.projection.source_system, "JPOS");
  assert.equal(source.projection.local_order_id, order.localOrderId);
  assert.equal(source.projection.hk_order_number, null);
  assert.equal(source.projection.order_number, order.localOrderId);
  assert.equal(source.projection.real_money, 110_000);
  assert.equal(source.projection.tax_money, 10_000);
  assert.equal(source.projection.amount_before_tax, 100_000);
});

test("JPOS projection keeps both local and HK identities after synchronization", () => {
  const order = paidOrder({ hkOrderNumber: "HK-889900" });
  const source = buildPosInvoiceSourceOrder(order, "2026-08-04", null, null);

  assert.equal(source.source_order_id, order.localOrderId);
  assert.equal(source.projection.local_order_id, order.localOrderId);
  assert.equal(source.projection.hk_order_number, "HK-889900");
  assert.equal(source.projection.order_number, "HK-889900");
});

test("VietQR lookup maps the official business response and caches it", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.VIETQR_TAX_API_BASE_URL;
  let calls = 0;
  process.env.VIETQR_TAX_API_BASE_URL = "https://api.vietqr.io/v2/business";
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        code: "00",
        desc: "Success",
        data: {
          id: "0312345679",
          name: "CÔNG TY TNHH VỊT VÀNG",
          internationalName: "GOLDEN DUCK COMPANY LIMITED",
          shortName: "GOLDEN DUCK",
          address: "Thành phố Hồ Chí Minh",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const first = await lookupVietQrTaxCode("0312345679");
    const second = await lookupVietQrTaxCode("0312345679");
    assert.equal(first.tax_code, "0312345679");
    assert.equal(first.legal_name, "CÔNG TY TNHH VỊT VÀNG");
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.VIETQR_TAX_API_BASE_URL;
    else process.env.VIETQR_TAX_API_BASE_URL = originalBaseUrl;
  }
});
