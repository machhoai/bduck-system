import assert from "node:assert/strict";
import test from "node:test";

import type {
  InvoiceBulkIssueInvoiceSummary,
  InvoiceBulkIssuePreview,
} from "@bduck/shared-types";

import { buildInvoiceBulkIssueWorkbook } from "./invoiceBulkIssueExcel";

const invoice = (
  id: string,
  productAmounts: Array<{
    name: string;
    quantity: number;
    amountWithoutVat: number;
  }>,
): InvoiceBulkIssueInvoiceSummary => {
  const totalAmountWithoutVat = productAmounts.reduce(
    (total, product) => total + product.amountWithoutVat,
    0,
  );
  const totalVatAmount = Math.round(totalAmountWithoutVat * 0.1);
  return {
    source_order_document_id: id,
    source_order_id: id,
    order_number: id,
    revision: 1,
    source_payload_hash: "a".repeat(64),
    payment_time: "2026-07-28T12:00:00+07:00",
    buyer: {
      full_name: "Bán cho người tiêu dùng",
      legal_name: "",
      tax_code: "",
      address: "",
      phone_number: "",
      email: "",
    },
    payment_method_name: "TM/CK",
    total_amount_without_vat: totalAmountWithoutVat,
    total_vat_amount: totalVatAmount,
    total_amount: totalAmountWithoutVat + totalVatAmount,
    products: productAmounts.map((product) => ({
      item_name: product.name,
      unit_name: "Vé",
      quantity: product.quantity,
      invoice_count: 1,
    })),
    lines: [],
  };
};

test("legacy multi-product preview fills unit price and line amounts", () => {
  const invoices = [
    invoice("single-a", [
      { name: "Vé lượt 5 gian hàng", quantity: 1, amountWithoutVat: 150_000 },
    ]),
    invoice("single-b", [
      { name: "Vé lượt tại site", quantity: 1, amountWithoutVat: 170_000 },
    ]),
    invoice("multi", [
      { name: "Vé lượt 5 gian hàng", quantity: 1, amountWithoutVat: 150_000 },
      { name: "Vé lượt tại site", quantity: 1, amountWithoutVat: 170_000 },
    ]),
  ];
  const preview: InvoiceBulkIssuePreview = {
    warehouse_id: "warehouse-1",
    business_date: "2026-07-28",
    selection_mode: "SELECTED",
    summary: {
      invoice_count: 3,
      eligible_count: 3,
      excluded_count: 0,
      total_amount_without_vat: 640_000,
      total_vat_amount: 64_000,
      total_amount: 704_000,
      product_line_count: 4,
      product_quantity: 4,
    },
    eligible_source_order_ids: invoices.map((item) => item.source_order_id),
    config_fingerprint: "test",
    invoices,
    product_summary: [],
    excluded: [],
  };

  const workbook = buildInvoiceBulkIssueWorkbook(preview);
  const sheet = workbook.getWorksheet("Hóa đơn GTGT");

  assert.ok(sheet);
  assert.deepEqual(
    [
      sheet.getCell("P12").value,
      sheet.getCell("Q12").value,
      sheet.getCell("R12").value,
    ],
    [150_000, 150_000, 165_000],
  );
  assert.deepEqual(
    [
      sheet.getCell("P13").value,
      sheet.getCell("Q13").value,
      sheet.getCell("R13").value,
    ],
    [170_000, 170_000, 187_000],
  );
  assert.equal(
    Number(sheet.getCell("Q12").value) + Number(sheet.getCell("Q13").value),
    320_000,
  );
  assert.equal(
    Number(sheet.getCell("R12").value) + Number(sheet.getCell("R13").value),
    352_000,
  );
});

test("legacy preview uses the invoice residual for products without a reference price", () => {
  const invoices = [
    invoice("single-reference", [
      { name: "Reference product", quantity: 1, amountWithoutVat: 117_273 },
    ]),
    invoice("multi-residual", [
      { name: "Residual product", quantity: 1, amountWithoutVat: 226_364 },
      { name: "Reference product", quantity: 1, amountWithoutVat: 117_273 },
    ]),
  ];
  invoices[1].total_vat_amount = 34_363;
  invoices[1].total_amount = 378_000;
  const preview: InvoiceBulkIssuePreview = {
    warehouse_id: "warehouse-1",
    business_date: "2026-07-28",
    selection_mode: "SELECTED",
    summary: {
      invoice_count: 2,
      eligible_count: 2,
      excluded_count: 0,
      total_amount_without_vat: 460_910,
      total_vat_amount: 46_090,
      total_amount: 507_000,
      product_line_count: 3,
      product_quantity: 3,
    },
    eligible_source_order_ids: invoices.map((item) => item.source_order_id),
    config_fingerprint: "test",
    invoices,
    product_summary: [],
    excluded: [],
  };

  const workbook = buildInvoiceBulkIssueWorkbook(preview);
  const sheet = workbook.getWorksheet("Hóa đơn GTGT");

  assert.ok(sheet);
  assert.deepEqual(
    [
      sheet.getCell("P11").value,
      sheet.getCell("Q11").value,
      sheet.getCell("R11").value,
    ],
    [226_364, 226_364, 249_000],
  );
  assert.deepEqual(
    [
      sheet.getCell("P12").value,
      sheet.getCell("Q12").value,
      sheet.getCell("R12").value,
    ],
    [117_273, 117_273, 129_000],
  );
});
