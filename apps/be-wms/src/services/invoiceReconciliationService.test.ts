import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoiceOrderMatchStatus,
  InvoiceReconciliationCaseType,
} from "@bduck/shared-types";
import { MeInvoiceClient } from "./meInvoiceClient.js";
import {
  normalizeMisaInvoice,
  reconcileDailyInvoices,
} from "./invoiceReconciliationPolicy.js";

test("reconciliation matches a historical source order using BuyerOrderCode", () => {
  const misa = normalizeMisaInvoice({
    RefID: "ref-1",
    TransactionID: "transaction-1",
    InvSeries: "1C26TAA",
    InvNo: "00001234",
    TotalAmount: 117000,
    CustomData: JSON.stringify({ BuyerOrderCode: "ORDER-19", SellerShopCode: "STORE-D" }),
  });
  const result = reconcileDailyInvoices({
    sources: [{ id: "source-1", source_order_id: "joy-1", order_number: "ORDER-19", real_money: 117000, invoice_document_id: null }],
    documents: [],
    misaInvoices: [misa],
    sellerShopCode: "STORE-D",
    invSeries: "1C26TAA",
    invoiceWithCode: true,
  });
  assert.equal(result.matches[0]?.match_status, InvoiceOrderMatchStatus.MATCHED);
  assert.equal(result.cases.length, 0);
  assert.equal(result.summary.matched_count, 1);
});

test("reconciliation reports missing source invoices and scoped MISA-only invoices", () => {
  const result = reconcileDailyInvoices({
    sources: [{ id: "source-1", source_order_id: "joy-1", order_number: "ORDER-1", real_money: 100000, invoice_document_id: null }],
    documents: [],
    misaInvoices: [normalizeMisaInvoice({ TransactionID: "transaction-2", SellerShopCode: "STORE-D", TotalAmount: 200000 })],
    sellerShopCode: "STORE-D",
    invSeries: "1C26TAA",
    invoiceWithCode: true,
  });
  assert.deepEqual(result.cases.map((item) => item.type).sort(), [
    InvoiceReconciliationCaseType.MISA_NOT_IN_SOURCE,
    InvoiceReconciliationCaseType.SOURCE_NOT_IN_MISA,
  ].sort());
});

test("unscoped MISA invoices do not create cross-store false positives", () => {
  const result = reconcileDailyInvoices({
    sources: [], documents: [],
    misaInvoices: [normalizeMisaInvoice({ TransactionID: "shared-account-invoice" })],
    sellerShopCode: "STORE-D", invSeries: "1C26TAA", invoiceWithCode: true,
  });
  assert.equal(result.cases.length, 0);
  assert.equal(result.summary.unscoped_misa_count, 1);
});

test("tax rejection remains an open reconciliation conclusion", () => {
  const result = reconcileDailyInvoices({
    sources: [{ id: "source-1", source_order_id: "joy-1", order_number: "ORDER-1", real_money: 100000, invoice_document_id: null }],
    documents: [],
    misaInvoices: [normalizeMisaInvoice({ TransactionID: "transaction-1", BuyerOrderCode: "ORDER-1", SellerShopCode: "STORE-D", TotalAmount: 100000, PublishStatus: 1, SendTaxStatus: 3 })],
    sellerShopCode: "STORE-D", invSeries: "1C26TAA", invoiceWithCode: true,
  });
  assert.ok(result.cases.some((item) => item.type === InvoiceReconciliationCaseType.TAX_REJECTED));
  assert.equal(result.summary.mismatch_count, 1);
});

test("published view and download use official endpoints and transaction IDs", async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const client = new MeInvoiceClient("https://developer.misa.vn/apis/itg/meinvoice", "client-id", (async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body) });
    const data = String(input).includes("publishview")
      ? "https://viewer.meinvoice.vn/invoice/short-lived"
      : [{ TransactionID: "transaction-1", Data: "JVBERi0xLjQK" }];
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch);
  const url = await client.viewPublishedInvoice("token", "transaction-1");
  assert.match(url, /^https:\/\/viewer\.meinvoice\.vn\//);
  const download = await client.downloadInvoice("token", {
    transactionId: "transaction-1", invoiceWithCode: true,
    invoiceCalculatingMachine: false, type: "Pdf",
  });
  assert.equal(download.data, "JVBERi0xLjQK");
  assert.deepEqual(requests.map((item) => JSON.parse(item.body)), [["transaction-1"], ["transaction-1"]]);
  assert.match(requests[1]!.url, /\/invoice\/Download\?/);
  assert.match(requests[1]!.url, /downloadDataType=Pdf/);
});

test("published view rejects a URL outside the MISA trust boundary", async () => {
  const client = new MeInvoiceClient("https://developer.misa.vn/apis/itg/meinvoice", "client-id", (async () =>
    new Response(JSON.stringify({ success: true, data: "https://evil.example/invoice" }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch);
  await assert.rejects(() => client.viewPublishedInvoice("token", "transaction-1"), /untrusted URL/i);
});
