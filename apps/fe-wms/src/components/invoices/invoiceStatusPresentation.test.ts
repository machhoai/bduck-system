import assert from "node:assert/strict";
import test from "node:test";

import { InvoiceDocumentStatus } from "@bduck/shared-types";

import {
  getInvoiceStatusPresentation,
  getMisaPublishStatusPresentation,
  getMisaTaxStatusLabel,
} from "./invoiceStatusPresentation";

test("pending confirmation distinguishes a MISA identity from an ambiguous result", () => {
  const known = getInvoiceStatusPresentation(
    InvoiceDocumentStatus.PENDING_CONFIRMATION,
    "vi",
    {
      transactionId: "TX-1",
      invoiceNumber: "00012132",
    },
  );
  const unknown = getInvoiceStatusPresentation(
    InvoiceDocumentStatus.PENDING_CONFIRMATION,
    "vi",
  );

  assert.match(known.label, /MISA đã trả số hóa đơn/u);
  assert.match(known.action ?? "", /Không phát hành lại/u);
  assert.match(unknown.label, /Chưa nhận được kết quả/u);
  assert.match(unknown.action ?? "", /Không phát hành lại/u);
  assert.notEqual(known.tone, unknown.tone);
});

test("manual reconciliation explains retry eligibility in both languages", () => {
  const retryable = getInvoiceStatusPresentation(
    InvoiceDocumentStatus.MANUAL_RECONCILIATION,
    "vi",
    { retryEligible: true, errorCode: "InvalidVatPercentage" },
  );
  const ambiguous = getInvoiceStatusPresentation(
    InvoiceDocumentStatus.MANUAL_RECONCILIATION,
    "zh",
  );

  assert.match(retryable.label, /có thể thử lại/u);
  assert.match(retryable.detail, /InvalidVatPercentage/u);
  assert.match(ambiguous.label, /禁止重复开具/u);
});

test("MISA status helpers never expose unexplained numeric states", () => {
  const published = getMisaPublishStatusPresentation(1, false, "vi");
  const unknown = getMisaPublishStatusPresentation(9, false, "zh");

  assert.equal(published.tone, "success");
  assert.match(published.label, /Đã phát hành/u);
  assert.match(unknown.label, /代码 9/u);
  assert.match(getMisaTaxStatusLabel(3, "vi") ?? "", /CQT từ chối/u);
});
