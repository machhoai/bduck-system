import { createHash } from "node:crypto";
import {
  InvoiceDocumentStatus,
  type InvoiceSourceOrderLine,
  type InvoiceVatRateName,
} from "@bduck/shared-types";
import { canonicalJson } from "./invoiceOrderSyncUtils.js";

const VAT_RATE_VALUES: Record<InvoiceVatRateName, number> = {
  "0%": 0,
  "5%": 5,
  "8%": 8,
  "10%": 10,
  KCT: 0,
  KKKNT: 0,
};

export const vatRateValue = (name: InvoiceVatRateName): number =>
  VAT_RATE_VALUES[name];

const financialFields = (line: InvoiceSourceOrderLine) => ({
  line_number: line.line_number,
  quantity: line.quantity,
  unit_price: line.unit_price,
  discount_rate: line.discount_rate,
  discount_amount: line.discount_amount,
  vat_rate_name: line.vat_rate_name,
});

export const invoiceFinancialFingerprint = (
  items: InvoiceSourceOrderLine[],
): string =>
  createHash("sha256")
    .update(canonicalJson(items.map(financialFields)))
    .digest("hex");

export const statusAfterInvoiceEdit = (
  sourceFinancialFingerprint: string,
  nextItems: InvoiceSourceOrderLine[],
): {
  status: InvoiceDocumentStatus;
  financiallyEdited: boolean;
} => {
  const financiallyEdited =
    invoiceFinancialFingerprint(nextItems) !== sourceFinancialFingerprint;
  return {
    status: financiallyEdited
      ? InvoiceDocumentStatus.NEEDS_SECOND_REVIEW
      : InvoiceDocumentStatus.NEEDS_REVIEW,
    financiallyEdited,
  };
};

export const canEditInvoiceDocument = (
  status: InvoiceDocumentStatus,
): boolean =>
  [
    InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION,
    InvoiceDocumentStatus.NEEDS_REVIEW,
    InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
    InvoiceDocumentStatus.READY_TO_ISSUE,
    InvoiceDocumentStatus.REJECTED,
  ].includes(status);

export const canReviewInvoiceDocument = (
  status: InvoiceDocumentStatus,
): boolean =>
  [
    InvoiceDocumentStatus.NEEDS_REVIEW,
    InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
  ].includes(status);

export type InvoiceReviewPolicyViolation =
  | "INVOICE_DOCUMENT_NOT_REVIEWABLE"
  | "INVOICE_DOCUMENT_NOT_ELIGIBLE"
  | "INVOICE_REVIEW_SOD_VIOLATION";

export const invoiceReviewPolicyViolation = (input: {
  status: InvoiceDocumentStatus;
  action: "APPROVE" | "REJECT";
  issueEligible: boolean;
  hasCalculation: boolean;
  editedBy: string | null;
  actorId: string;
}): InvoiceReviewPolicyViolation | null => {
  if (!canReviewInvoiceDocument(input.status)) {
    return "INVOICE_DOCUMENT_NOT_REVIEWABLE";
  }
  if (input.action === "REJECT") return null;
  if (!input.issueEligible || !input.hasCalculation) {
    return "INVOICE_DOCUMENT_NOT_ELIGIBLE";
  }
  if (input.editedBy === input.actorId) {
    return "INVOICE_REVIEW_SOD_VIOLATION";
  }
  return null;
};
