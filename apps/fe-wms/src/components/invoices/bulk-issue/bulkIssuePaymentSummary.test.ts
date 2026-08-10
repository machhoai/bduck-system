import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeBulkIssuePayments } from "./bulkIssuePaymentSummary";

describe("summarizeBulkIssuePayments", () => {
  it("groups invoice totals and counts by payment method", () => {
    const result = summarizeBulkIssuePayments(
      [
        { payment_method_name: "Tiền mặt", total_amount: 120_000 },
        { payment_method_name: "Chuyển khoản", total_amount: 300_000 },
        { payment_method_name: "Tiền mặt", total_amount: 80_000 },
      ],
      "Chưa xác định",
    );

    assert.deepEqual(result, [
      {
        paymentMethodName: "Tiền mặt",
        invoiceCount: 2,
        totalAmount: 200_000,
      },
      {
        paymentMethodName: "Chuyển khoản",
        invoiceCount: 1,
        totalAmount: 300_000,
      },
    ]);
  });

  it("trims names and groups blank methods under the fallback label", () => {
    const result = summarizeBulkIssuePayments(
      [
        { payment_method_name: "  TM/CK  ", total_amount: 50_000 },
        { payment_method_name: "TM/CK", total_amount: 25_000 },
        { payment_method_name: "   ", total_amount: 10_000 },
      ],
      "Chưa xác định",
    );

    assert.deepEqual(result, [
      {
        paymentMethodName: "TM/CK",
        invoiceCount: 2,
        totalAmount: 75_000,
      },
      {
        paymentMethodName: "Chưa xác định",
        invoiceCount: 1,
        totalAmount: 10_000,
      },
    ]);
  });
});
