import type {
  PosOrderPaymentStatus,
  PosOrderSyncStatus,
} from "@bduck/shared-types";

export type PosOrderCancellationMode = "LOCAL_ONLY" | "REMOTE_REFUND";

export interface PosOrderLifecycleInput {
  status?: string;
  paymentStatus?: string;
  syncStatus?: string;
  hkOrderNumber?: string | null;
  source?: string;
  cancellationOperationId?: string | null;
}

export interface PosOrderCancellationDecision {
  allowed: boolean;
  idempotent: boolean;
  mode: PosOrderCancellationMode;
  code: string | null;
}

const INVOICE_BLOCKING_STATUSES = new Set([
  "SUBMITTING",
  "PENDING_CONFIRMATION",
  "ISSUED",
  "POST_ISSUE_REVIEW",
  "CLOSED",
]);

export const derivePosOrderPaymentStatus = (
  order: PosOrderLifecycleInput,
): PosOrderPaymentStatus => {
  if (
    [
      "DRAFT",
      "PAID",
      "REFUNDING",
      "REFUNDED",
      "REFUND_FAILED",
      "REFUND_UNKNOWN",
    ].includes(order.paymentStatus ?? "")
  ) {
    return order.paymentStatus as PosOrderPaymentStatus;
  }
  return order.status === "DRAFT" ? "DRAFT" : "PAID";
};

export const derivePosOrderSyncStatus = (
  order: PosOrderLifecycleInput,
): PosOrderSyncStatus => {
  if (
    [
      "NOT_SYNCED",
      "PENDING",
      "SYNCING",
      "SYNC_FAILED",
      "SYNC_SUCCESS",
      "CANCELLED",
    ].includes(order.syncStatus ?? "")
  ) {
    return order.syncStatus as PosOrderSyncStatus;
  }
  const legacy: Record<string, PosOrderSyncStatus> = {
    DRAFT: "NOT_SYNCED",
    LOCAL_PAID: "PENDING",
    SYNCING: "SYNCING",
    SYNC_FAILED: "SYNC_FAILED",
    SYNC_SUCCESS: "SYNC_SUCCESS",
  };
  return legacy[order.status ?? ""] ?? "NOT_SYNCED";
};

export const isInvoiceCancellationBlocked = (status: unknown): boolean =>
  typeof status === "string" && INVOICE_BLOCKING_STATUSES.has(status);

export const decidePosOrderCancellation = (
  order: PosOrderLifecycleInput,
  invoiceStatuses: unknown[] = [],
): PosOrderCancellationDecision => {
  const paymentStatus = derivePosOrderPaymentStatus(order);
  const syncStatus = derivePosOrderSyncStatus(order);
  const mode: PosOrderCancellationMode =
    syncStatus === "SYNC_SUCCESS" || Boolean(order.hkOrderNumber)
      ? "REMOTE_REFUND"
      : "LOCAL_ONLY";

  if (paymentStatus === "REFUNDED" || syncStatus === "CANCELLED") {
    return { allowed: true, idempotent: true, mode, code: null };
  }
  if (order.source === "JOYWORLD_IMPORT") {
    return {
      allowed: false,
      idempotent: false,
      mode,
      code: "IMPORTED_READ_ONLY",
    };
  }
  if (invoiceStatuses.some(isInvoiceCancellationBlocked)) {
    return { allowed: false, idempotent: false, mode, code: "INVOICE_LOCKED" };
  }
  if (syncStatus === "SYNCING" || order.status === "SYNCING") {
    return { allowed: false, idempotent: false, mode, code: "ORDER_SYNCING" };
  }
  if (paymentStatus === "REFUNDING") {
    return {
      allowed: false,
      idempotent: false,
      mode,
      code: "REFUND_IN_PROGRESS",
    };
  }
  if (paymentStatus === "REFUND_UNKNOWN") {
    return { allowed: false, idempotent: false, mode, code: "REFUND_UNKNOWN" };
  }
  return { allowed: true, idempotent: false, mode, code: null };
};

export const normalizePosOrderPhone = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11)
    return `0${digits.slice(2)}`;
  return digits;
};
