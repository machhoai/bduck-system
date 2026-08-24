import { InvoiceIssueItemStatus } from "@bduck/shared-types";

const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DAY_MS = 24 * 60 * 60 * 1_000;

export const INVOICE_ISSUE_TIME_ZONE = "Asia/Ho_Chi_Minh" as const;
export const INVOICE_RATE_LIMIT_BASE_COOLDOWN_MS = 5 * 60_000;

const validBusinessDate = (businessDate: string): string => {
  const match = BUSINESS_DATE_PATTERN.exec(businessDate);
  if (!match) throw new Error("INVOICE_BUSINESS_DATE_INVALID");

  const [, year, month, day] = match;
  const instant = new Date(`${businessDate}T00:00:00+07:00`);
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: INVOICE_ISSUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});
  if (
    formatted.year !== year ||
    formatted.month !== month ||
    formatted.day !== day
  ) {
    throw new Error("INVOICE_BUSINESS_DATE_INVALID");
  }
  return businessDate;
};

export const invoiceIssueBusinessDate = (
  sourceBusinessDate: unknown,
  paymentTime: unknown,
): string => {
  if (typeof sourceBusinessDate === "string" && sourceBusinessDate.trim()) {
    return validBusinessDate(sourceBusinessDate.trim());
  }
  if (typeof paymentTime !== "string") {
    throw new Error("INVOICE_PAYMENT_TIME_INVALID");
  }
  const instant = new Date(paymentTime);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("INVOICE_PAYMENT_TIME_INVALID");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INVOICE_ISSUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return validBusinessDate(
    `${part("year")}-${part("month")}-${part("day")}`,
  );
};

/**
 * Exclusive deadline: 00:00:00 of the next Vietnam calendar day.
 * Vietnam has a fixed UTC+7 offset and no daylight-saving transition.
 */
export const invoiceIssueDeadline = (businessDate: string): Date => {
  const start = new Date(`${validBusinessDate(businessDate)}T00:00:00+07:00`);
  return new Date(start.getTime() + DAY_MS);
};

export const dateFromInvoiceValue = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
};

export const invoiceIssueDeadlineExpired = (
  deadline: Date,
  now = new Date(),
): boolean => now.getTime() >= deadline.getTime();

export const retryTimeBeforeInvoiceDeadline = (
  retryAfterMs: number,
  deadline: Date,
  now = new Date(),
): Date | null => {
  const next = new Date(now.getTime() + Math.max(0, retryAfterMs));
  return next.getTime() < deadline.getTime() ? next : null;
};

export const deadlineTerminalInvoiceIssueStatus = (
  status: InvoiceIssueItemStatus,
): InvoiceIssueItemStatus =>
  [
    InvoiceIssueItemStatus.PENDING_CONFIRMATION,
    InvoiceIssueItemStatus.SUBMITTING,
    InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
  ].includes(status)
    ? InvoiceIssueItemStatus.MANUAL_RECONCILIATION
    : InvoiceIssueItemStatus.CANCELLED;
