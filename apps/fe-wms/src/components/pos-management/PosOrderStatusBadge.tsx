import type {
  PosOrderPaymentStatus,
  PosOrderSyncStatus,
} from "@bduck/shared-types";

import { usePosOrderCopy } from "./usePosOrderCopy";

const styles: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REFUNDING: "border-amber-200 bg-amber-50 text-amber-700",
  REFUNDED: "border-blue-200 bg-blue-50 text-blue-700",
  REFUND_FAILED: "border-red-200 bg-red-50 text-red-700",
  REFUND_UNKNOWN: "border-orange-200 bg-orange-50 text-orange-700",
  NOT_SYNCED: "border-slate-200 bg-slate-50 text-slate-600",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  SYNCING: "border-cyan-200 bg-cyan-50 text-cyan-700",
  SYNC_FAILED: "border-red-200 bg-red-50 text-red-700",
  SYNC_SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
};

export function PosOrderStatusBadge({
  status,
}: {
  status: PosOrderPaymentStatus | PosOrderSyncStatus;
}) {
  const copy = usePosOrderCopy();
  const labels: Record<string, string> = {
    DRAFT: copy.draft,
    PAID: copy.paid,
    REFUNDING: copy.refunding,
    REFUNDED: copy.refunded,
    REFUND_FAILED: copy.refundFailed,
    REFUND_UNKNOWN: copy.refundUnknown,
    NOT_SYNCED: copy.notSynced,
    PENDING: copy.pending,
    SYNCING: copy.syncing,
    SYNC_FAILED: copy.syncFailed,
    SYNC_SUCCESS: copy.syncSuccess,
    CANCELLED: copy.cancelled,
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xxs font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
