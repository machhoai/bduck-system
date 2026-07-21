import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoicePreparationStatus,
  type InvoiceSourceOrderLine,
  type MeInvoiceOptionUserDefined,
} from "@bduck/shared-types";
import { calculateInvoice } from "./invoiceCalculationService.js";
import { adaptJoyworldOrderItems } from "./invoiceOrderAdapter.js";
import { preflightInvoiceSourceOrder } from "./invoicePreflightService.js";

const option: MeInvoiceOptionUserDefined = {
  main_currency: "VND",
  amount_decimal_digits: 0,
  amount_oc_decimal_digits: 0,
  unit_price_oc_decimal_digits: 0,
  unit_price_decimal_digits: 0,
  quantity_decimal_digits: 2,
  coefficient_decimal_digits: 0,
  exchange_rate_decimal_digits: 2,
};

const baseLine = (overrides: Partial<InvoiceSourceOrderLine> = {}): InvoiceSourceOrderLine => ({
  line_number: 1,
  source_item_id: "sku-1",
  item_code: "sku-1",
  item_name: "Vé vui chơi",
  category_code: "1",
  category_name: "Vé",
  unit_name: "Vé",
  quantity: 1,
  unit_price: 100_000,
  discount_rate: null,
  discount_amount: 0,
  vat_rate_name: "10%",
  vat_rate: 10,
  source_amount_without_vat: 100_000,
  source_vat_amount: 10_000,
  source_total_amount: 110_000,
  ...overrides,
});

test("adapter maps the approved JoyWorld sample without binary money arithmetic", () => {
  const lines = adaptJoyworldOrderItems(
    [{
      goodsName: "BDUCK Vịt con lắc lư kỳ thú",
      category: 1,
      price: 170_000,
      qty: 1,
      discountMoney: 0,
      realMoney: 187_000,
      taxRate: 10,
      taxMoney: 17_000,
    }],
    [{
      goodsId: "sku-duck",
      goodsName: "BDUCK Vịt con lắc lư kỳ thú",
    }],
    {
      price_includes_vat: true,
      tax_rate_source: "SOURCE",
      default_vat_rate_name: null,
      default_unit_name: "Cái",
      sku_mapping: { "sku-duck": { unit_name: "Vé" } },
      category_vat_mapping: {},
      unit_price_decimal_digits: 0,
    },
  );
  assert.equal(lines[0].item_code, "sku-duck");
  assert.equal(lines[0].unit_price, 187_000);
  assert.equal(lines[0].source_amount_without_vat, 170_000);

  const result = calculateInvoice(lines, true, option);
  assert.ok(result);
  assert.equal(result.lines[0].unit_price, 170_000);
  assert.equal(result.lines[0].amount, 170_000);
  assert.equal(result.total_amount_without_vat, 170_000);
  assert.equal(result.total_vat_amount, 17_000);
  assert.equal(result.total_amount, 187_000);
});

test("adapter fills a missing source unit from the store default", () => {
  const [line] = adaptJoyworldOrderItems(
    [{ goodsName: "Vé vào cửa", price: 100_000, qty: 1, taxRate: 10 }],
    [],
    {
      price_includes_vat: false,
      tax_rate_source: "SOURCE",
      default_vat_rate_name: "10%",
      default_unit_name: "Vé",
      sku_mapping: {},
      category_vat_mapping: {},
      unit_price_decimal_digits: 0,
    },
  );

  assert.equal(line.unit_name, "Vé");
});

test("calculation is deterministic and aggregates multiple VAT groups", () => {
  const lines = [
    baseLine({ line_number: 1, vat_rate_name: "0%", vat_rate: 0, source_vat_amount: 0, source_total_amount: 100_000 }),
    baseLine({ line_number: 2, source_item_id: "sku-2", item_code: "sku-2", vat_rate_name: "5%", vat_rate: 5, source_vat_amount: 5_000, source_total_amount: 105_000 }),
    baseLine({ line_number: 3, source_item_id: "sku-3", item_code: "sku-3", vat_rate_name: "8%", vat_rate: 8, source_vat_amount: 8_000, source_total_amount: 108_000 }),
    baseLine({ line_number: 4, source_item_id: "sku-4", item_code: "sku-4" }),
    baseLine({ line_number: 5, source_item_id: "sku-5", item_code: "sku-5", vat_rate_name: "KCT", vat_rate: 0, source_vat_amount: 0, source_total_amount: 100_000 }),
  ];
  const first = calculateInvoice(lines, false, option);
  const second = calculateInvoice(lines, false, option);
  assert.ok(first);
  assert.deepEqual(first, second);
  assert.equal(first.tax_rate_info.length, 5);
  assert.equal(first.total_amount_without_vat, 500_000);
  assert.equal(first.total_vat_amount, 23_000);
});

test("rounding uses decimal half-up at the configured scale", () => {
  const result = calculateInvoice([
    baseLine({
      quantity: 3,
      unit_price: 33.5,
      vat_rate_name: "5%",
      vat_rate: 5,
      source_amount_without_vat: null,
      source_vat_amount: null,
      source_total_amount: null,
    }),
  ], false, option);
  assert.ok(result);
  assert.equal(result.lines[0].amount, 101);
  assert.equal(result.lines[0].vat_amount, 5);
  assert.equal(result.lines[0].total_amount, 106);
});

test("preflight allows a complete post-go-live order", () => {
  const lines = [baseLine()];
  const calculation = calculateInvoice(lines, false, option);
  const result = preflightInvoiceSourceOrder({
    lines,
    calculation,
    amount_decimal_digits: 0,
    source_amount_without_vat: 100_000,
    source_vat_amount: 10_000,
    source_total_amount: 110_000,
    payment_time: new Date("2026-07-20T03:00:00.000Z"),
    mapped_payment_method: "Tiền mặt",
    store_config_exists: true,
    store_config_enabled: true,
    price_includes_vat: false,
    inv_series: "1C26TAA",
    go_live_at: new Date("2026-07-20T02:00:00.000Z"),
    account_exists: true,
    account_enabled: true,
    account_last_test_succeeded: true,
  });
  assert.equal(result.status, InvoicePreparationStatus.READY_TO_ISSUE);
  assert.equal(result.issue_eligible, true);
  assert.deepEqual(result.issues, []);
});

test("preflight blocks pre-go-live orders and missing VAT configuration", () => {
  const lines = [baseLine({ vat_rate_name: null, vat_rate: null })];
  const result = preflightInvoiceSourceOrder({
    lines,
    calculation: null,
    amount_decimal_digits: 0,
    source_amount_without_vat: 100_000,
    source_vat_amount: 10_000,
    source_total_amount: 110_000,
    payment_time: new Date("2026-07-19T03:00:00.000Z"),
    mapped_payment_method: "Tiền mặt",
    store_config_exists: true,
    store_config_enabled: true,
    price_includes_vat: false,
    inv_series: "1C26TAA",
    go_live_at: new Date("2026-07-20T02:00:00.000Z"),
    account_exists: true,
    account_enabled: true,
    account_last_test_succeeded: true,
  });
  assert.equal(result.status, InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION);
  assert.equal(result.issue_eligible, false);
  assert.ok(result.issues.some((item) => item.code === "BEFORE_GO_LIVE"));
  assert.ok(result.issues.some((item) => item.code === "VAT_RATE_MISSING"));
});

test("preflight accepts 199 lines and rejects 200 lines", () => {
  const run = (count: number) => {
    const lines = Array.from({ length: count }, (_, index) => baseLine({ line_number: index + 1 }));
    return preflightInvoiceSourceOrder({
      lines,
      calculation: calculateInvoice(lines, false, option),
      amount_decimal_digits: 0,
      source_amount_without_vat: null,
      source_vat_amount: null,
      source_total_amount: null,
      payment_time: new Date("2026-07-20T03:00:00.000Z"),
      mapped_payment_method: "Tiền mặt",
      store_config_exists: true,
      store_config_enabled: true,
      price_includes_vat: false,
      inv_series: "1C26TAA",
      go_live_at: new Date("2026-07-20T02:00:00.000Z"),
      account_exists: true,
      account_enabled: true,
      account_last_test_succeeded: true,
    });
  };
  assert.equal(run(199).issues.some((item) => item.code === "ITEM_LIMIT_EXCEEDED"), false);
  assert.equal(run(200).issues.some((item) => item.code === "ITEM_LIMIT_EXCEEDED"), true);
});
