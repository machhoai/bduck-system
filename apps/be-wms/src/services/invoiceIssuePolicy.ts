import { createHash } from "node:crypto";
import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
  InvoiceOrderMatchStatus,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import { MeInvoiceApiError } from "./meInvoiceClient.js";

export const issueJobId = (
  warehouseId: string,
  actorId: string,
  idempotencyKey: string,
) => createHash("sha256").update(`${warehouseId}:${actorId}:${idempotencyKey}`).digest("hex");

export const invoiceLaneId = (accountId: string, invSeries: string) =>
  createHash("sha256").update(`${accountId}:${invSeries}`).digest("hex");

export const sameInvoiceDocumentSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left]
    .sort()
    .every((value, index) => value === sortedRight[index]);
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
  actorId: string,
): InvoiceIssueCandidateIssue[] => {
  const issues: InvoiceIssueCandidateIssue[] = [];
  if (document.status !== InvoiceDocumentStatus.READY_TO_ISSUE) {
    issues.push({ code: "DOCUMENT_NOT_READY", message: "Draft is not ready to issue." });
  }
  if (document.issue_eligible !== true || !document.calculation) {
    issues.push({ code: "DOCUMENT_NOT_ELIGIBLE", message: "Draft did not pass validation." });
  }
  if (
    sourceOrder.source_payload_hash !== document.source_payload_hash ||
    sourceOrder.is_deleted === true
  ) {
    issues.push({ code: "SOURCE_STALE", message: "Source order changed after review." });
  }
  if (sourceOrder.match_status === InvoiceOrderMatchStatus.MATCHED) {
    issues.push({ code: "SOURCE_ALREADY_INVOICED", message: "Order is already matched to an invoice." });
  }
  if (document.active_issue_job_id) {
    issues.push({ code: "ACTIVE_ISSUE_JOB", message: "Draft already belongs to an active issue job." });
  }
  if (document.financially_edited === true && document.edited_by === actorId) {
    issues.push({ code: "SEGREGATION_OF_DUTIES", message: "Financial editor cannot issue the same draft." });
  }
  const paymentTime = dateValue(document.payment_time);
  if (!config.go_live_at || !paymentTime || paymentTime < config.go_live_at) {
    issues.push({ code: "BEFORE_GO_LIVE", message: "Payment happened before invoice go-live." });
  }
  return issues;
};

export type InvoiceFailureDecision =
  | { status: InvoiceIssueItemStatus.PENDING_CONFIRMATION; retryAfterMs: number }
  | { status: InvoiceIssueItemStatus.RETRYABLE_ERROR; retryAfterMs: number }
  | { status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION; retryAfterMs: null };

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
    (error instanceof MeInvoiceApiError && (error.httpStatus === 401 || error.httpStatus === 429))
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
