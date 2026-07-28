import assert from "node:assert/strict";
import test from "node:test";
import type {
  InvoiceCalculatedLine,
  MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import type { StoredMeInvoiceAccount } from "../repositories/meInvoiceConfigRepository.js";
import {
  buildBulkIssueInvoiceSummaries,
  summarizeBulkIssue,
} from "./invoiceBulkIssuePolicy.js";
import { buildMeInvoicePayload } from "./meInvoicePayloadBuilder.js";
import { invoiceOrderShouldAppearInList } from "./invoiceOrderVisibilityPolicy.js";

const line = (
  itemName: string,
  unitName: string,
  itemQuantity: number,
): InvoiceCalculatedLine => ({
  line_number: 1,
  source_item_id: "item-1",
  item_code: "ITEM-1",
  item_name: itemName,
  category_code: null,
  category_name: null,
  unit_name: unitName,
  quantity: itemQuantity,
  unit_price: 100_000,
  discount_rate: null,
  discount_amount: null,
  vat_rate_name: "10%",
  vat_rate: 10,
  source_amount_without_vat: 90_909,
  source_vat_amount: 9_091,
  source_total_amount: 100_000,
  amount: 90_909,
  calculated_discount_amount: 0,
  amount_without_vat: 90_909,
  vat_amount: 9_091,
  total_amount: 100_000,
});

const config = {
  item_name_mapping: {
    "B.Duck Vịt con bắn nước tung tăng": "Vé lượt",
  },
  item_unit_mapping: {
    "B.Duck Vịt con bắn nước tung tăng": "Cái",
  },
  unit_name_mapping: { Vé: "Cái" },
  default_unit_name: "Cái",
  inv_series: "1C26TAA",
  seller_shop_code: "SHOP-1",
  seller_shop_name: "Shop 1",
  default_payment_method_name: "Tiền mặt",
  default_buyer_name: "Khách lẻ",
  default_buyer_address: "",
  invoice_with_code: true,
  is_invoice_calculating_machine: true,
  option_user_defined: {
    main_currency: "VND",
    amount_decimal_digits: 0,
    amount_oc_decimal_digits: 0,
    unit_price_oc_decimal_digits: 0,
    unit_price_decimal_digits: 0,
    quantity_decimal_digits: 2,
    coefficient_decimal_digits: 0,
    exchange_rate_decimal_digits: 2,
  },
} as unknown as MeInvoiceStoreConfig;

const calculation = {
  version: "test",
  lines: [line("B.Duck Vịt con bắn nước tung tăng", "Vé", 2)],
  tax_rate_info: [
    {
      vat_rate_name: "10%" as const,
      amount_without_vat: 90_909,
      vat_amount: 9_091,
    },
  ],
  total_amount_without_vat: 90_909,
  total_vat_amount: 9_091,
  total_amount: 100_000,
  calculation_hash: "hash",
};

test("invoice list hides only zero-value orders that are not successful", () => {
  assert.equal(
    invoiceOrderShouldAppearInList({ source_status: 4, real_money: 0 }),
    false,
  );
  assert.equal(
    invoiceOrderShouldAppearInList({ source_status: 3, real_money: 0 }),
    true,
  );
  assert.equal(
    invoiceOrderShouldAppearInList({ source_status: 4, real_money: 100_000 }),
    true,
  );
});

test("bulk preview groups quantities by mapped product name and unit", () => {
  const result = buildBulkIssueInvoiceSummaries(
    [
      {
        id: "document-1",
        source_order_id: "order-1",
        source_order_number: "HD-1",
        payment_time: "2026-07-28T10:00:00+07:00",
        calculation,
      },
    ],
    config,
  );

  assert.deepEqual(result.product_summary, [
    {
      item_name: "Vé lượt",
      unit_name: "Cái",
      quantity: 2,
      invoice_count: 1,
    },
  ]);
  assert.equal(result.invoices[0]?.products[0]?.item_name, "Vé lượt");
});

test("unit mapping can differ between products with the same source unit", () => {
  const productConfig = {
    ...config,
    item_unit_mapping: {
      "B.Duck Vịt con bắn nước tung tăng": "Cái",
      "Vé khu vui chơi": "Lượt",
    },
  };
  const result = buildBulkIssueInvoiceSummaries(
    [
      {
        id: "document-1",
        source_order_id: "order-1",
        source_order_number: "HD-1",
        payment_time: "2026-07-28T10:00:00+07:00",
        calculation: {
          ...calculation,
          lines: [
            line("B.Duck Vịt con bắn nước tung tăng", "Vé", 2),
            line("Vé khu vui chơi", "Vé", 1),
          ],
        },
      },
    ],
    productConfig,
  );

  assert.deepEqual(
    result.product_summary.map(({ item_name, unit_name }) => ({
      item_name,
      unit_name,
    })),
    [
      { item_name: "Vé khu vui chơi", unit_name: "Lượt" },
      { item_name: "Vé lượt", unit_name: "Cái" },
    ],
  );
});

test("zero-priced products are excluded from summaries and MISA payload", () => {
  const paidLine = line("B.Duck Vịt con bắn nước tung tăng", "Vé", 2);
  const freeLine = {
    ...line("Quà tặng 0đ", "Cái", 1),
    unit_price: 0,
    source_amount_without_vat: 0,
    source_vat_amount: 0,
    source_total_amount: 0,
    amount: 0,
    amount_without_vat: 0,
    vat_amount: 0,
    total_amount: 0,
  };
  const mixedCalculation = {
    ...calculation,
    lines: [paidLine, freeLine],
  };
  const document = {
    id: "document-1",
    source_order_id: "order-1",
    source_order_number: "HD-1",
    payment_time: "2026-07-28T10:00:00+07:00",
    items: [paidLine, freeLine],
    calculation: mixedCalculation,
  };

  const preview = buildBulkIssueInvoiceSummaries([document], config);
  assert.equal(preview.product_summary.length, 1);
  assert.equal(preview.product_summary[0]?.item_name, "Vé lượt");

  const summary = summarizeBulkIssue(1, [document], []);
  assert.equal(summary.product_line_count, 1);
  assert.equal(summary.product_quantity, 2);

  const built = buildMeInvoicePayload(
    {
      warehouse_id: "warehouse-1",
      source_order_id: "order-1",
      source_order_number: "HD-1",
      payment_time: "2026-07-28T10:00:00+07:00",
      payment_method_name: "Tiền mặt",
      buyer: {},
      calculation: mixedCalculation,
    },
    config,
    {
      id: "account-1",
      legal_entity_id: "legal-1",
    } as StoredMeInvoiceAccount,
  );
  const details = built.payload.OriginalInvoiceDetail as Array<
    Record<string, unknown>
  >;
  assert.equal(details.length, 1);
  assert.equal(details[0]?.ItemName, "Vé lượt");
});

test("MISA payload applies saved product and unit mappings", () => {
  const built = buildMeInvoicePayload(
    {
      warehouse_id: "warehouse-1",
      source_order_id: "order-1",
      source_order_number: "HD-1",
      payment_time: "2026-07-28T10:00:00+07:00",
      payment_method_name: "Tiền mặt",
      buyer: {},
      calculation,
    },
    config,
    {
      id: "account-1",
      legal_entity_id: "legal-1",
    } as StoredMeInvoiceAccount,
  );
  const detail = built.payload.OriginalInvoiceDetail as Array<
    Record<string, unknown>
  >;

  assert.equal(detail[0]?.ItemName, "Vé lượt");
  assert.equal(detail[0]?.UnitName, "Cái");
});
