import assert from "node:assert/strict";
import test from "node:test";

import {
  InvoiceDocumentStatus,
  InvoicePreparationStatus,
} from "@bduck/shared-types";

import type { InvoiceSourceOrderView } from "@/api/invoiceApi";

import {
  invoiceDatesInRange,
  invoiceBusinessStatus,
  orderMatchesAttentionFilter,
} from "./invoiceWorkspacePresentation.js";

test("date range supports up to 31 inclusive business days", () => {
  assert.deepEqual(invoiceDatesInRange("2026-08-22", "2026-08-23"), [
    "2026-08-22",
    "2026-08-23",
  ]);
  assert.deepEqual(invoiceDatesInRange("2026-01-01", "2026-02-01"), []);
});

const order = (
  overrides: Partial<InvoiceSourceOrderView> = {},
): InvoiceSourceOrderView =>
  ({
    id: "order-a",
    invoice_document_id: "order-a",
    invoice_document_status: InvoiceDocumentStatus.READY_TO_ISSUE,
    misa_error_code: null,
    preflight: {
      status: InvoicePreparationStatus.READY_TO_ISSUE,
      issue_eligible: true,
      issues: [],
    },
    ...overrides,
  }) as InvoiceSourceOrderView;

test("workspace exposes one business status per invoice", () => {
  assert.equal(invoiceBusinessStatus(order()), "READY");
  assert.equal(
    invoiceBusinessStatus(
      order({ invoice_document_status: InvoiceDocumentStatus.SUBMITTING }),
    ),
    "SENDING",
  );
  assert.equal(
    invoiceBusinessStatus(
      order({
        invoice_document_status: InvoiceDocumentStatus.MANUAL_RECONCILIATION,
      }),
    ),
    "DISCREPANCY",
  );
});

test("attention filters group financial and MISA failures", () => {
  const taxMismatch = order({
    invoice_document_status: InvoiceDocumentStatus.NEEDS_CORRECTION,
    preflight: {
      status: InvoicePreparationStatus.NEEDS_CORRECTION,
      issue_eligible: false,
      issues: [
        {
          code: "VAT_AMOUNT_MISMATCH",
          severity: "ERROR",
          message: "VAT differs",
          path: "tax",
        },
      ],
    },
  });
  assert.equal(
    orderMatchesAttentionFilter(taxMismatch, "FINANCIAL_MISMATCH"),
    true,
  );
  assert.equal(
    orderMatchesAttentionFilter(
      order({
        invoice_document_status: InvoiceDocumentStatus.RETRYABLE_ERROR,
      }),
      "MISA_REJECTED",
    ),
    true,
  );
});
