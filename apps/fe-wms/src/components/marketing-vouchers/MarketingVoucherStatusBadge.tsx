import type {
  MarketingVoucherCampaignStatus,
  MarketingVoucherEffectiveStatus,
  MarketingVoucherJobStatus,
} from "@bduck/shared-types";

const styles: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PROCESSING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  GENERATING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  QUEUED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  DISTRIBUTED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  PAUSED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  PARTIAL: "bg-orange-50 text-orange-700 ring-orange-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  GENERATION_FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  REVOKED: "bg-slate-100 text-slate-700 ring-slate-600/20",
  USED: "bg-violet-50 text-violet-700 ring-violet-600/20",
  EXPIRED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  ENDED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

type VoucherStatus =
  | MarketingVoucherCampaignStatus
  | MarketingVoucherEffectiveStatus
  | MarketingVoucherJobStatus;

export function MarketingVoucherStatusBadge({
  status,
  label,
}: {
  status: VoucherStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status] ?? styles.ENDED}`}
    >
      {label}
    </span>
  );
}
