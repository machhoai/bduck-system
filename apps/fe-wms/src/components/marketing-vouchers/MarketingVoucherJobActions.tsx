"use client";

import type { MarketingVoucherJob } from "@bduck/shared-types";
import { Download, Eye, RotateCcw } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/vi";

export function MarketingVoucherJobActions({
  job,
  canResume,
  canDownload,
  isPending,
  copy,
  onResume,
  onViewResults,
  onDownload,
}: {
  job: MarketingVoucherJob;
  canResume: boolean;
  canDownload: boolean;
  isPending: boolean;
  copy: Dictionary["marketingVouchers"];
  onResume: () => void;
  onViewResults: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {job.type === "SEND_EMAIL" ? (
        <button
          type="button"
          onClick={onViewResults}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
        >
          <Eye size={14} />
          {copy.jobs.viewResults}
        </button>
      ) : null}
      {job.type === "EXPORT_EXCEL" &&
      job.status === "COMPLETED" &&
      canDownload ? (
        <button
          type="button"
          disabled={isPending}
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          <Download size={14} />
          {copy.jobs.download}
        </button>
      ) : null}
      {canResume ? (
        <button
          type="button"
          disabled={isPending}
          onClick={onResume}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          <RotateCcw size={14} />
          {copy.jobs.resume}
        </button>
      ) : null}
    </div>
  );
}
