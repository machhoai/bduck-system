import { createHash } from "node:crypto";
import {
  InvoiceDocumentStatus,
  type InvoicePreflightIssue,
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

const SOURCE_MONEY_COMPARISON_ISSUE_CODES = new Set([
  "LINE_AMOUNT_MISMATCH",
  "LINE_VAT_MISMATCH",
  "LINE_TOTAL_MISMATCH",
  "MASTER_AMOUNT_MISMATCH",
  "MASTER_VAT_MISMATCH",
  "MASTER_TOTAL_MISMATCH",
]);

const PREFLIGHT_DOCUMENT_STATUSES = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION,
  InvoiceDocumentStatus.NEEDS_CORRECTION,
  InvoiceDocumentStatus.READY_TO_ISSUE,
]);

export const vatRateValue = (name: InvoiceVatRateName): number =>
  VAT_RATE_VALUES[name];

export const validationStateWithoutSourceMoneyComparison = (
  status: InvoiceDocumentStatus,
  issues: InvoicePreflightIssue[],
): {
  status: InvoiceDocumentStatus;
  issueEligible: boolean;
  issues: InvoicePreflightIssue[];
} | null => {
  if (!PREFLIGHT_DOCUMENT_STATUSES.has(status)) return null;
  const remainingIssues = issues.filter(
    (item) => !SOURCE_MONEY_COMPARISON_ISSUE_CODES.has(item.code),
  );
  if (remainingIssues.length === issues.length) return null;

  const hasError = remainingIssues.some((item) => item.severity === "ERROR");
  const needsTaxConfiguration = remainingIssues.some((item) =>
    ["PRICE_VAT_MODE_UNCONFIRMED", "VAT_RATE_MISSING"].includes(item.code));
  return {
    status: needsTaxConfiguration
      ? InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION
      : hasError
        ? InvoiceDocumentStatus.NEEDS_CORRECTION
        : InvoiceDocumentStatus.READY_TO_ISSUE,
    issueEligible: !hasError,
    issues: remainingIssues,
  };
};

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
    status: InvoiceDocumentStatus.READY_TO_ISSUE,
    financiallyEdited,
  };
};

export const canEditInvoiceDocument = (
  status: InvoiceDocumentStatus,
): boolean =>
  [
    InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION,
    InvoiceDocumentStatus.NEEDS_CORRECTION,
    InvoiceDocumentStatus.NEEDS_REVIEW,
    InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
    InvoiceDocumentStatus.READY_TO_ISSUE,
    InvoiceDocumentStatus.REJECTED,
  ].includes(status);
