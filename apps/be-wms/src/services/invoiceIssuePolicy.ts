import { createHash } from "node:crypto";

import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
  InvoiceOrderMatchStatus,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";

import { invoiceFinancialFingerprint } from "./invoiceDocumentPolicy.js";
import type { NormalizedMisaInvoice } from "./invoiceReconciliationPolicy.js";
import { MeInvoiceApiError } from "./meInvoiceClient.js";

export const issueJobId = (
  warehouseId: string,
  actorId: string,
  idempotencyKey: string,
) =>
  createHash("sha256")
    .update(`${warehouseId}:${actorId}:${idempotencyKey}`)
    .digest("hex");

export const invoiceLaneId = (accountId: string, invSeries: string) =>
  createHash("sha256").update(`${accountId}:${invSeries}`).digest("hex");

export const sameInvoiceDocumentSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left].sort().every((value, index) => value === sortedRight[index]);
};

export interface InvoiceIssueCandidateIssue {
  code: string;
  message: string;
}

const dateValue = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const result = (value as { toDate: () => Date }).toDate();
    return result instanceof Date ? result : null;
  }
  if (typeof value === "string") {
    const result = new Date(value);
    return Number.isFinite(result.getTime()) ? result : null;
  }
  return null;
};

export const validateInvoiceIssueCandidate = (
  document: Record<string, unknown>,
  sourceOrder: Record<string, unknown>,
  config: MeInvoiceStoreConfig,
  _actorId: string,
): InvoiceIssueCandidateIssue[] => {
  const issues: InvoiceIssueCandidateIssue[] = [];
  const allowedStatuses = [
    InvoiceDocumentStatus.NEEDS_REVIEW,
    InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
    InvoiceDocumentStatus.READY_TO_ISSUE,
  ];
  if (!allowedStatuses.includes(document.status as InvoiceDocumentStatus)) {
    issues.push({
      code: "DOCUMENT_NOT_READY",
      message: "Draft is not ready to issue.",
    });
  }
  if (document.issue_eligible !== true || !document.calculation) {
    issues.push({
      code: "DOCUMENT_NOT_ELIGIBLE",
      message: "Draft did not pass validation.",
    });
  }
  if (
    sourceOrder.source_payload_hash !== document.source_payload_hash ||
    sourceOrder.is_deleted === true
  ) {
    issues.push({
      code: "SOURCE_STALE",
      message: "Source order changed after review.",
    });
  }
  const sourceItems = Array.isArray(sourceOrder.normalized_items)
    ? sourceOrder.normalized_items
    : [];
  const sourceCalculation =
    sourceOrder.calculation && typeof sourceOrder.calculation === "object"
      ? (sourceOrder.calculation as Record<string, unknown>)
      : null;
  const documentCalculation =
    document.calculation && typeof document.calculation === "object"
      ? (document.calculation as Record<string, unknown>)
      : null;
  if (
    sourceItems.length > 0 &&
    (invoiceFinancialFingerprint(sourceItems) !==
      document.source_financial_fingerprint ||
      sourceCalculation?.calculation_hash !==
        documentCalculation?.calculation_hash)
  ) {
    issues.push({
      code: "SOURCE_FINANCIALS_STALE",
      message:
        "Draft tax or financial calculation is older than the source order.",
    });
  }
  if (sourceOrder.match_status === InvoiceOrderMatchStatus.MATCHED) {
    issues.push({
      code: "SOURCE_ALREADY_INVOICED",
      message: "Order is already matched to an invoice.",
    });
  }
  if (document.active_issue_job_id) {
    issues.push({
      code: "ACTIVE_ISSUE_JOB",
      message: "Draft already belongs to an active issue job.",
    });
  }
  const paymentTime = dateValue(document.payment_time);
  if (!config.go_live_at || !paymentTime || paymentTime < config.go_live_at) {
    issues.push({
      code: "BEFORE_GO_LIVE",
      message: "Payment happened before invoice go-live.",
    });
  }
  return issues;
};

export type InvoiceFailureDecision =
  | {
      status: InvoiceIssueItemStatus.PENDING_CONFIRMATION;
      retryAfterMs: number;
    }
  | { status: InvoiceIssueItemStatus.RETRYABLE_ERROR; retryAfterMs: number }
  | {
      status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION;
      retryAfterMs: null;
    };

const AMBIGUOUS_CODES = new Set([
  "TIMEOUT",
  "NETWORK_ERROR",
  "INVALID_PUBLISH_RESPONSE",
  "DuplicateInvoiceRefID",
  "InvoiceDuplicated",
]);

const RETRYABLE_CODES = new Set([
  "TooManyRequest",
  "ServiceUnavailable",
  "TokenExpired",
]);

export const classifyInvoiceIssueFailure = (
  error: unknown,
  attempt: number,
): InvoiceFailureDecision => {
  const code =
    error instanceof MeInvoiceApiError
      ? error.code
      : typeof error === "string"
        ? error
        : null;
  const boundedAttempt = Math.max(1, attempt);
  const backoff = Math.min(15 * 60_000, 15_000 * 2 ** (boundedAttempt - 1));
  const ambiguousCode =
    code &&
    (AMBIGUOUS_CODES.has(code) ||
      code.startsWith("DuplicateInvoiceRefID") ||
      code.startsWith("InvoiceDuplicated"));
  if (
    ambiguousCode ||
    (error instanceof MeInvoiceApiError && error.httpStatus >= 500)
  ) {
    return {
      status: InvoiceIssueItemStatus.PENDING_CONFIRMATION,
      retryAfterMs: backoff,
    };
  }
  if (
    (code && RETRYABLE_CODES.has(code)) ||
    (error instanceof MeInvoiceApiError &&
      (error.httpStatus === 401 || error.httpStatus === 429))
  ) {
    return {
      status: InvoiceIssueItemStatus.RETRYABLE_ERROR,
      retryAfterMs: backoff,
    };
  }
  return {
    status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
    retryAfterMs: null,
  };
};

export const statusIsIssued = (publishStatus: number, isDeleted: boolean) =>
  publishStatus === 1 && !isDeleted;

export const isExplicitMisaRejection = (
  item: Record<string, unknown>,
): boolean => {
  if (item.status !== InvoiceIssueItemStatus.MANUAL_RECONCILIATION)
    return false;
  if (
    typeof item.misa_error_code !== "string" ||
    !item.misa_error_code.trim()
  ) {
    return false;
  }
  if (item.transaction_id || item.invoice_number || item.invoice_code)
    return false;
  if (item.retry_eligible === true) return true;

  // Backward compatibility for item-level MISA errors recorded before
  // retry_eligible existed. These are explicit per-invoice rejections from
  // publishInvoiceResult, not ambiguous transport failures.
  return (
    typeof item.last_error === "string" &&
    item.last_error.startsWith("MISA item error:")
  );
};

const USER_RETRY_STATUSES = new Set<InvoiceIssueItemStatus>([
  InvoiceIssueItemStatus.PENDING_CONFIRMATION,
  InvoiceIssueItemStatus.RETRYABLE_ERROR,
  InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
]);

export const isUserRetryCandidate = (item: Record<string, unknown>): boolean =>
  USER_RETRY_STATUSES.has(item.status as InvoiceIssueItemStatus) &&
  !item.manual_retry_requested_at &&
  typeof item.ref_id === "string" &&
  Boolean(item.ref_id.trim());

const normalizedIdentity = (value: unknown): string | null =>
  typeof value === "string" && value.trim()
    ? value.trim().toLocaleUpperCase("vi")
    : null;

const normalizedDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  return value.match(/^(\d{4}-\d{2}-\d{2})/u)?.[1] ?? null;
};

export type InvoiceRetryDuplicateReason =
  | "REF_ID"
  | "ORDER_CODE"
  | "BUSINESS_FINGERPRINT";

export const findInvoiceRetryDuplicate = (
  input: {
    refId: string;
    sourceOrderId: string;
    orderNumber: string | null;
    invSeries: string;
    businessDate: string;
    totalAmount: number | null;
    buyerTaxCode: string | null;
    buyerName: string | null;
    sellerShopCode: string | null;
  },
  invoices: NormalizedMisaInvoice[],
): {
  reason: InvoiceRetryDuplicateReason;
  invoice: NormalizedMisaInvoice;
} | null => {
  const refId = normalizedIdentity(input.refId);
  const orderCodes = new Set(
    [input.sourceOrderId, input.orderNumber]
      .map(normalizedIdentity)
      .filter((value): value is string => Boolean(value)),
  );
  const invSeries = normalizedIdentity(input.invSeries);
  const buyerTaxCode = normalizedIdentity(input.buyerTaxCode);
  const buyerName = normalizedIdentity(input.buyerName);
  const buyerIdentity =
    buyerTaxCode ||
    (buyerName &&
    !buyerName.includes("KHÁCH LẺ") &&
    !buyerName.includes("KHACH LE")
      ? buyerName
      : null);
  const sellerShopCode = normalizedIdentity(input.sellerShopCode);

  for (const invoice of invoices) {
    if (refId && normalizedIdentity(invoice.ref_id) === refId) {
      return { reason: "REF_ID", invoice };
    }
  }
  for (const invoice of invoices) {
    const buyerOrderCode = normalizedIdentity(invoice.buyer_order_code);
    if (buyerOrderCode && orderCodes.has(buyerOrderCode)) {
      return { reason: "ORDER_CODE", invoice };
    }
  }
  if (input.totalAmount === null || !buyerIdentity) return null;
  for (const invoice of invoices) {
    const sameSeller =
      !sellerShopCode ||
      !invoice.seller_shop_code ||
      normalizedIdentity(invoice.seller_shop_code) === sellerShopCode;
    if (
      sameSeller &&
      normalizedIdentity(invoice.inv_series) === invSeries &&
      normalizedDate(invoice.invoice_date) === input.businessDate &&
      (buyerTaxCode
        ? normalizedIdentity(invoice.buyer_tax_code) === buyerTaxCode
        : normalizedIdentity(invoice.buyer_name) === buyerIdentity) &&
      invoice.total_amount !== null &&
      Math.abs(invoice.total_amount - input.totalAmount) < 1
    ) {
      return { reason: "BUSINESS_FINGERPRINT", invoice };
    }
  }
  return null;
};
