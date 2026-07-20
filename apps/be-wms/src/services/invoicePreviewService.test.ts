import assert from "node:assert/strict";
import test from "node:test";
import {
  MeInvoiceEnvironment,
  MeInvoiceSignType,
  type InvoiceSourceOrderLine,
  type MeInvoiceStoreConfig,
  type MeInvoiceOptionUserDefined,
} from "@bduck/shared-types";
import type { StoredMeInvoiceAccount } from "../repositories/meInvoiceConfigRepository.js";
import { calculateInvoice } from "./invoiceCalculationService.js";
import { MeInvoiceApiError, MeInvoiceClient } from "./meInvoiceClient.js";
import { buildMeInvoicePayload } from "./meInvoicePayloadBuilder.js";

const option: MeInvoiceOptionUserDefined = {
  main_currency: "VND",
  amount_decimal_digits: 0,
  amount_oc_decimal_digits: 0,
  unit_price_oc_decimal_digits: 0,
  unit_price_decimal_digits: 0,
  quantity_decimal_digits: 2,
  coefficient_decimal_digits: 2,
  exchange_rate_decimal_digits: 2,
};

const line: InvoiceSourceOrderLine = {
  line_number: 1,
  source_item_id: "sku-duck",
  item_code: "SKU-DUCK",
  item_name: "Vé vui chơi",
  category_code: "1",
  category_name: "Vé",
  unit_name: "Vé",
  quantity: 1,
  unit_price: 187_000,
  discount_rate: null,
  discount_amount: 0,
  vat_rate_name: "10%",
  vat_rate: 10,
  source_amount_without_vat: 170_000,
  source_vat_amount: 17_000,
  source_total_amount: 187_000,
};

const storeConfig = {
  id: "store-1",
  warehouse_id: "store-1",
  meinvoice_account_id: "account-1",
  inv_series: "1C26MAA",
  invoice_with_code: true,
  sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
  is_invoice_calculating_machine: true,
  seller_shop_code: "BDUCK-01",
  seller_shop_name: "BDUCK Store 01",
  price_includes_vat: true,
  tax_rate_source: "SOURCE",
  default_vat_rate_name: null,
  sku_mapping: {},
  category_vat_mapping: {},
  payment_method_mapping: { "Thanh toán bằng tiền mặt": "Tiền mặt" },
  go_live_at: new Date("2026-07-20T00:00:00.000Z"),
  invoice_date_source: "PAYMENT_TIME",
  issue_scope: "GO_LIVE_FORWARD",
  default_buyer_name: "Khách lẻ (Không lấy hóa đơn)",
  default_buyer_address: "",
  default_buyer_tax_code: null,
  option_user_defined: option,
  enabled: true,
  validated_at: new Date("2026-07-20T00:00:00.000Z"),
  validation_error_code: null,
  created_by: "admin",
  updated_by: "admin",
  is_deleted: false,
  created_at: new Date("2026-07-20T00:00:00.000Z"),
  updated_at: new Date("2026-07-20T00:00:00.000Z"),
} satisfies MeInvoiceStoreConfig;

const account = {
  id: "account-1",
  legal_entity_id: "legal-entity-1",
  display_name: "BDUCK",
  tax_code: "0101243150",
  environment: MeInvoiceEnvironment.SANDBOX,
  base_url: "https://developer.misa.vn/apis/itg/meinvoice",
  enabled: true,
  created_by: "admin",
  updated_by: "admin",
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
} satisfies StoredMeInvoiceAccount;

test("payload builder produces the documented MISA InvoiceData contract", () => {
  const calculation = calculateInvoice([line], true, option);
  assert.ok(calculation);
  const order = {
    warehouse_id: "store-1",
    source_order_id: "order-1",
    order_number: "BD02069241782200271704683",
    payment_time: "2026-07-20 14:37:59",
    mapped_payment_method: "Tiền mặt",
    calculation,
  };
  const first = buildMeInvoicePayload(order, storeConfig, account);
  const second = buildMeInvoicePayload(order, storeConfig, account);
  assert.deepEqual(first, second);
  assert.match(first.ref_id, /^[0-9a-f-]{36}$/);
  assert.equal(first.payload.TotalAmountWithoutVATOC, 170_000);
  assert.equal(first.payload.TotalVATAmountOC, 17_000);
  assert.equal(first.payload.TotalAmountOC, 187_000);
  const details = first.payload.OriginalInvoiceDetail as Record<
    string,
    unknown
  >[];
  assert.equal(details[0].UnitPrice, 170_000);
  assert.equal(details[0].VATRateName, "10%");
  assert.equal(details[0].DiscountRate, 0);

  const draftPayload = buildMeInvoicePayload(
    {
      ...order,
      source_order_number: "DRAFT-ORDER-1",
      payment_method_name: "TM/CK",
      buyer: {
        full_name: "Nguyễn Văn A",
        legal_name: "Công ty A",
        tax_code: "0101243150",
        address: "Hà Nội",
        phone_number: "0900000000",
        email: "buyer@example.com",
      },
    },
    storeConfig,
    account,
  ).payload;
  assert.equal(draftPayload.PaymentMethodName, "TM/CK");
  assert.equal(draftPayload.BuyerFullName, "Nguyễn Văn A");
  assert.equal(draftPayload.BuyerLegalName, "Công ty A");
  assert.equal(draftPayload.BuyerTaxCode, "0101243150");
  assert.equal(draftPayload.BuyerOrderCode, "DRAFT-ORDER-1");
});

test("MeInvoiceClient posts InvoiceData directly and accepts only trusted preview URLs", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async (input, init) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body);
      return new Response(
        JSON.stringify({
          Success: true,
          Data: "https://download.meinvoice.vn/preview?id=123",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
  );
  const url = await client.previewInvoice("token", { RefID: "ref-1" });
  assert.equal(capturedUrl.endsWith("/invoice/unpublishview"), true);
  assert.deepEqual(JSON.parse(capturedBody), { RefID: "ref-1" });
  assert.equal(url, "https://download.meinvoice.vn/preview?id=123");

  const untrustedClient = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async () =>
      new Response(
        JSON.stringify({
          Success: true,
          Data: "https://example.com/phishing",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );
  await assert.rejects(
    () => untrustedClient.previewInvoice("token", { RefID: "ref-1" }),
    (error) =>
      error instanceof MeInvoiceApiError &&
      error.code === "UNTRUSTED_PREVIEW_URL",
  );
});
