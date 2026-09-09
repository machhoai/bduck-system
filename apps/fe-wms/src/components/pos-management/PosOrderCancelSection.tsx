"use client";

import type {
  PosOrderCancelResult,
  PosOrderDetail,
  PosOrderRefundPreview,
} from "@bduck/shared-types";
import { AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { posManagementApi } from "@/api/posManagementApi";
import { showToast } from "@/utils/toast";

import { usePosOrderCopy } from "./usePosOrderCopy";

interface Props {
  warehouseId: string;
  order: PosOrderDetail;
  preview: PosOrderRefundPreview | null;
  previewError: string | null;
  previewLoading: boolean;
  canCancelLocal: boolean;
  canRefundRemote: boolean;
  onCancelled: (result: PosOrderCancelResult) => void;
}

export function PosOrderCancelSection({
  warehouseId,
  order,
  preview,
  previewError,
  previewLoading,
  canCancelLocal,
  canRefundRemote,
  onCancelled,
}: Props) {
  const copy = usePosOrderCopy();
  const [reason, setReason] = useState(order.cancellation?.reason ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isRemote = preview?.mode === "REMOTE_REFUND";
  const hasPermission = isRemote ? canRefundRemote : canCancelLocal;
  const reasonValid = reason.trim().length >= 3;
  const confirmationValid = !isRemote || confirmed;
  const blockedReason = preview?.blockedReason
    ? ({
        ORDER_SYNCING: copy.blockedSyncing,
        INVOICE_LOCKED: copy.blockedInvoice,
        IMPORTED_READ_ONLY: copy.blockedImported,
        REFUND_IN_PROGRESS: copy.blockedRefunding,
        REFUND_UNKNOWN: copy.blockedUnknown,
        CANCEL_PERMISSION_DENIED: copy.noPermission,
      }[preview.blockedReason] ?? copy.cancellationBlocked)
    : null;
  const canSubmit = Boolean(
    preview?.refundable && hasPermission && reasonValid && confirmationValid,
  );

  async function cancelOrder() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const action = posManagementApi
      .getOrder(warehouseId, order.localOrderId)
      .then((latest) =>
        posManagementApi.cancelOrder(warehouseId, order.localOrderId, {
          reason: reason.trim(),
          action_time: new Date().toISOString(),
          expectedVersion: latest.version,
          refundConfirmed: isRemote && confirmed,
        }),
      );
    try {
      const result = await showToast.promise(action, {
        loading: copy.cancelLoading,
        success: copy.cancelSuccess,
        successDescription: copy.cancelSuccessDescription,
        error: copy.cancelError,
        errorDescription: (error) =>
          error instanceof Error ? error.message : copy.cancellationBlocked,
        retry: () => void cancelOrder(),
        retryLabel: copy.retry,
      });
      onCancelled(result);
    } finally {
      setSubmitting(false);
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void cancelOrder();
  };

  if (order.cancellation?.status === "SUCCEEDED") {
    return <CancellationAudit order={order} />;
  }

  return (
    <div className="space-y-3">
      {order.cancellation ? <CancellationAudit order={order} /> : null}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
        <h3 className="flex items-center gap-2 text-xs font-bold text-slate-900">
          <RotateCcw size={15} className="text-amber-600" />
          {copy.cancelOrder}
        </h3>

        {previewLoading ? (
          <p className="mt-2 animate-pulse text-xs text-slate-500">
            {copy.previewLoading}
          </p>
        ) : null}
        {previewError ? <Warning text={previewError} /> : null}
        {blockedReason ? <Warning text={blockedReason} /> : null}
        {preview ? (
          <div className="mt-2 rounded-lg border border-amber-100 bg-white p-2.5 text-xs">
            <p className="font-semibold text-slate-700">
              {isRemote ? copy.remoteRefund : copy.localOnly}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-500">
              <span>
                {copy.previewAmount}:{" "}
                <strong className="text-slate-800">
                  {formatMoney(preview.amount)}
                </strong>
              </span>
              <span>
                {copy.previewMethod}:{" "}
                <strong className="text-slate-800">
                  {preview.paymentMethodNames || "—"}
                </strong>
              </span>
            </div>
          </div>
        ) : null}
        {preview && !hasPermission && !blockedReason ? (
          <Warning text={copy.noPermission} />
        ) : null}

        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-xs font-bold text-slate-700">
            {copy.cancelReason}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.cancelReasonPlaceholder}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          {reason.length > 0 && !reasonValid ? (
            <p className="text-xxs font-semibold text-red-600">
              {copy.reasonRequired}
            </p>
          ) : null}
          {isRemote ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white p-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span>{copy.refundConfirmation}</span>
            </label>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            <RotateCcw size={14} />
            {submitting ? copy.cancelLoading : copy.cancelOrder}
          </button>
        </form>
      </section>
    </div>
  );
}

function CancellationAudit({ order }: { order: PosOrderDetail }) {
  const copy = usePosOrderCopy();
  const cancellation = order.cancellation!;
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="flex items-center gap-2 text-xs font-bold text-slate-900">
        <Ban size={15} className="text-slate-500" />
        {copy.cancelAudit}
      </h3>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        <AuditItem label={copy.operationId} value={cancellation.operationId} />
        <AuditItem label={copy.status} value={cancellation.status} />
        <AuditItem
          label={copy.actionTime}
          value={formatTime(cancellation.actionTime)}
        />
        <AuditItem
          label={copy.syncTime}
          value={formatTime(cancellation.syncTime)}
        />
        <AuditItem label={copy.cancelReason} value={cancellation.reason} />
        <AuditItem
          label={copy.refundOrderNumber}
          value={cancellation.refundOrderNumber || "—"}
        />
        {cancellation.lastError ? (
          <AuditItem label={copy.lastError} value={cancellation.lastError} />
        ) : null}
      </dl>
    </section>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

function AuditItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xxs text-slate-400">{label}</dt>
      <dd className="break-all font-semibold text-slate-700">{value}</dd>
    </div>
  );
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );

const formatTime = (value: string) => new Date(value).toLocaleString("vi-VN");
