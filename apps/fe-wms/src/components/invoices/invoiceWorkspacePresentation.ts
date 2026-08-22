import {
  InvoiceDocumentStatus,
  InvoicePreparationStatus,
} from "@bduck/shared-types";

import type { InvoiceSourceOrderView } from "@/api/invoiceApi";

export type InvoiceWorkspaceTab = "ACTION_REQUIRED" | "READY" | "ISSUED";

export type InvoiceAttentionFilter =
  | "ALL"
  | "MISSING_INFORMATION"
  | "FINANCIAL_MISMATCH"
  | "WAITING_MISA"
  | "MISA_REJECTED"
  | "MANUAL_REVIEW";

export type InvoiceBusinessStatus =
  | "NOT_READY"
  | "REVIEW_REQUIRED"
  | "READY"
  | "SENDING"
  | "ISSUED"
  | "ISSUE_FAILED"
  | "DISCREPANCY";

export const invoiceDatesInRange = (start: string, end: string) => {
  if (!start || !end || end < start) return [];
  const values: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && values.length < 31) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor <= last ? [] : values;
};

const READY_DOCUMENT_STATUSES = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.NEEDS_REVIEW,
  InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
  InvoiceDocumentStatus.READY_TO_ISSUE,
]);

const SENDING_DOCUMENT_STATUSES = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.QUEUED,
  InvoiceDocumentStatus.SUBMITTING,
  InvoiceDocumentStatus.PENDING_CONFIRMATION,
]);

const ISSUED_DOCUMENT_STATUSES = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.ISSUED,
  InvoiceDocumentStatus.POST_ISSUE_REVIEW,
  InvoiceDocumentStatus.CLOSED,
]);

const FAILED_DOCUMENT_STATUSES = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.RETRYABLE_ERROR,
  InvoiceDocumentStatus.REJECTED,
  InvoiceDocumentStatus.CANCELLED,
]);

const issueText = (order: InvoiceSourceOrderView) =>
  order.preflight.issues
    .flatMap((issue) => [issue.code, issue.message, issue.path])
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

export const invoiceBusinessStatus = (
  order: InvoiceSourceOrderView,
): InvoiceBusinessStatus => {
  const documentStatus = order.invoice_document_status;
  if (documentStatus && ISSUED_DOCUMENT_STATUSES.has(documentStatus)) {
    return "ISSUED";
  }
  if (documentStatus === InvoiceDocumentStatus.MANUAL_RECONCILIATION) {
    return "DISCREPANCY";
  }
  if (documentStatus && SENDING_DOCUMENT_STATUSES.has(documentStatus)) {
    return "SENDING";
  }
  if (
    (documentStatus && FAILED_DOCUMENT_STATUSES.has(documentStatus)) ||
    Boolean(order.misa_error_code)
  ) {
    return "ISSUE_FAILED";
  }
  if (
    order.preflight.issue_eligible === true &&
    Boolean(order.invoice_document_id) &&
    documentStatus &&
    READY_DOCUMENT_STATUSES.has(documentStatus)
  ) {
    return "READY";
  }
  if (
    order.preflight.status === InvoicePreparationStatus.NEEDS_REVIEW ||
    order.preflight.status === InvoicePreparationStatus.NEEDS_CORRECTION
  ) {
    return "REVIEW_REQUIRED";
  }
  return "NOT_READY";
};

export const orderMatchesAttentionFilter = (
  order: InvoiceSourceOrderView,
  filter: InvoiceAttentionFilter,
): boolean => {
  if (filter === "ALL") return true;
  const status = invoiceBusinessStatus(order);
  const issues = issueText(order);
  if (filter === "WAITING_MISA") return status === "SENDING";
  if (filter === "MISA_REJECTED") return status === "ISSUE_FAILED";
  if (filter === "MANUAL_REVIEW") {
    return status === "REVIEW_REQUIRED" || status === "DISCREPANCY";
  }
  if (filter === "FINANCIAL_MISMATCH") {
    return /(VAT|TAX|THUẾ|AMOUNT|TOTAL|MONEY|FINANC|CALCULATION)/.test(issues);
  }
  return /(MISSING|REQUIRED|EMPTY|THIẾU|BUYER|CUSTOMER|ADDRESS|TAX_CODE)/.test(
    issues,
  );
};

export const orderBelongsToWorkspaceTab = (
  order: InvoiceSourceOrderView,
  tab: InvoiceWorkspaceTab,
) => {
  const status = invoiceBusinessStatus(order);
  if (tab === "READY") return status === "READY";
  if (tab === "ISSUED") return status === "ISSUED";
  return status !== "READY" && status !== "ISSUED";
};

export const canSelectForInvoiceIssue = (order: InvoiceSourceOrderView) =>
  invoiceBusinessStatus(order) === "READY";
