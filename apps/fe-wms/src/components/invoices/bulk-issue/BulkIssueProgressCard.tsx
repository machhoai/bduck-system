"use client";

import { CheckCircle2 } from "lucide-react";
import type { InvoiceBulkIssueRunView } from "@/api/invoiceApi";
import type { useInvoiceBulkIssueProgress } from "@/hooks/useInvoiceBulkIssueProgress";
import { bulkIssueTranslations } from "./bulkIssueTranslations";

export function BulkIssueProgressCard({
  run,
  progress,
  lang,
}: {
  run: InvoiceBulkIssueRunView;
  progress: ReturnType<typeof useInvoiceBulkIssueProgress>;
  lang: "vi" | "zh";
}) {
  const d = bulkIssueTranslations[lang];
  const percent = run.summary.eligible_count
    ? (progress.issued / run.summary.eligible_count) * 100
    : 0;

  return (
    <div className="mt-2.5 rounded-md border border-sky-200 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-xs font-bold text-slate-900">
          {progress.complete
            ? d.progressCompleted
            : d.progressProcessing}
        </p>
        <span className="text-xxs font-semibold text-slate-500">
          {progress.issued}/{run.summary.eligible_count}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xxs text-slate-600">
        <span>
          {progress.issued} {d.statusIssued}
        </span>
        <span>
          {progress.queued + progress.submitting}{" "}
          {d.statusSubmitting}
        </span>
        <span>
          {progress.pending + progress.retrying}{" "}
          {d.statusPendingMisa}
        </span>
        <span>
          {progress.needsAttention} {d.statusNeedsAttention}
        </span>
      </div>
      {progress.complete && progress.needsAttention === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xxs font-semibold text-emerald-700">
          <CheckCircle2 size={13} />{" "}
          {d.allProcessed}
        </p>
      )}
      {run.summary.eligible_count === 0 && (
        <p className="mt-2 text-xxs text-slate-500">
          {d.noValidInvoices}
        </p>
      )}
      {progress.error && (
        <p className="mt-2 text-xxs text-rose-700">{progress.error}</p>
      )}
    </div>
  );
}

