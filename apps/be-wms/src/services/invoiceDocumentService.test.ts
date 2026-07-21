import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoiceDocumentStatus,
  InvoicePreparationStatus,
  MeInvoiceEnvironment,
  MeInvoiceSignType,
  type InvoiceSourceOrderLine,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import type { StoredMeInvoiceAccount } from "../repositories/meInvoiceConfigRepository.js";
import { calculateInvoice } from "./invoiceCalculationService.js";
import {
  invoiceFinancialFingerprint,
  statusAfterInvoiceEdit,
} from "./invoiceDocumentPolicy.js";
import { invoiceDocumentUpdateSchema } from "./invoiceDocumentSchemas.js";
import { buildInitialInvoiceDocument } from "./invoiceDocumentDraftBuilder.js";

const option = {
  main_currency: "VND",
  amount_decimal_digits: 0,
  amount_oc_decimal_digits: 0,
  unit_price_oc_decimal_digits: 0,
  unit_price_decimal_digits: 0,
  quantity_decimal_digits: 2,
  coefficient_decimal_digits: 0,
  exchange_rate_decimal_digits: 2,
};

const sourceLine: InvoiceSourceOrderLine = {
  line_number: 1,
  source_item_id: "sku-1",
  item_code: "SKU-1",
  item_name: "Sản phẩm",
  category_code: null,
  category_name: null,
  unit_name: "Cái",
  quantity: 1,
  unit_price: 110_000,
  discount_rate: null,
  discount_amount: null,
  vat_rate_name: "10%",
  vat_rate: 10,
  source_amount_without_vat: 100_000,
  source_vat_amount: 10_000,
  source_total_amount: 110_000,
};

const storeConfig = {
  id: "warehouse-1",
  warehouse_id: "warehouse-1",
  meinvoice_account_id: "account-1",
  inv_series: "1C26MYY",
  invoice_with_code: true,
  sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
  is_invoice_calculating_machine: true,
  seller_shop_code: "SHOP-1",
  seller_shop_name: "Shop 1",
  price_includes_vat: true,
  tax_rate_source: "SKU",
  default_vat_rate_name: "10%",
  sku_mapping: {},
  category_vat_mapping: {},
  payment_method_mapping: {},
  go_live_at: new Date("2026-07-01T00:00:00+07:00"),
  invoice_date_source: "PAYMENT_TIME",
  issue_scope: "GO_LIVE_FORWARD",
  default_buyer_name: "Khách lẻ (Không lấy hóa đơn)",
  default_buyer_address: "",
  default_buyer_tax_code: null,
  option_user_defined: option,
  enabled: true,
  validated_at: new Date(),
  validation_error_code: null,
  created_by: "admin",
  updated_by: "admin",
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
} as MeInvoiceStoreConfig;

const account = {
  id: "account-1",
  legal_entity_id: "legal-1",
  environment: MeInvoiceEnvironment.SANDBOX,
  enabled: true,
  is_deleted: false,
  last_test_succeeded: true,
} as StoredMeInvoiceAccount;

test("draft edits remain ready to issue without an approval state", () => {
  const sourceFingerprint = invoiceFinancialFingerprint([sourceLine]);
  const textOnly = statusAfterInvoiceEdit(sourceFingerprint, [
    {
      ...sourceLine,
      item_name: "Tên mới",
    },
  ]);
  const financial = statusAfterInvoiceEdit(sourceFingerprint, [
    {
      ...sourceLine,
      quantity: 2,
    },
  ]);

  assert.deepEqual(textOnly, {
    status: InvoiceDocumentStatus.READY_TO_ISSUE,
    financiallyEdited: false,
  });
  assert.deepEqual(financial, {
    status: InvoiceDocumentStatus.READY_TO_ISSUE,
    financiallyEdited: true,
  });
});

test("draft update schema rejects duplicate lines and ambiguous discounts", () => {
  const result = invoiceDocumentUpdateSchema.safeParse({
    warehouse_id: "warehouse-1",
    expected_revision: 1,
    expected_source_payload_hash: "a".repeat(64),
    buyer: {
      full_name: "Khách lẻ",
      legal_name: "",
      tax_code: "",
      address: "",
      phone_number: "",
      email: "",
    },
    payment_method_name: "TM/CK",
    items: [1, 2].map(() => ({
      ...sourceLine,
      vat_rate: undefined,
      line_number: 1,
      discount_rate: 5,
      discount_amount: 1_000,
    })),
  });
  assert.equal(result.success, false);
});

test("initial document preserves source data and starts at revision one", () => {
  const calculation = calculateInvoice([sourceLine], true, option);
  const document = buildInitialInvoiceDocument(
    {
      id: "a".repeat(64),
      warehouse_id: "warehouse-1",
      source_order_id: "order-1",
      source_payload_hash: "b".repeat(64),
      order_number: "HD-1",
      payment_time: "2026-07-20 10:00:00",
      source_action_time: new Date("2026-07-20T03:00:00Z"),
      mapped_payment_method: "TM/CK",
      normalized_items: [sourceLine],
      calculation,
      preflight: {
        status: InvoicePreparationStatus.READY_TO_ISSUE,
        issue_eligible: true,
        issues: [],
      },
      mapping_version: "mapping-v1",
      calculation_version: "calculation-v1",
    },
    storeConfig,
    account,
    "importer-1",
    new Date("2026-07-20T04:00:00Z"),
  );

  assert.ok(document);
  assert.equal(document.revision, 1);
  assert.equal(document.status, InvoiceDocumentStatus.READY_TO_ISSUE);
  assert.equal(document.financially_edited, false);
  assert.deepEqual(document.buyer, {
    full_name: "Khách lẻ (Không lấy hóa đơn)",
    legal_name: "",
    tax_code: "",
    address: "",
    phone_number: "",
    email: "",
  });
});
