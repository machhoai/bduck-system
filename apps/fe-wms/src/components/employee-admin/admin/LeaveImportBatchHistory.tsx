"use client";

import {
  LeaveImportBatchStatus,
  type LeaveImportBatch,
} from "@bduck/shared-types";
import { History } from "lucide-react";

const statusLabel = (
  status: LeaveImportBatchStatus,
  labels: Record<string, string>,
) =>
  ({
    [LeaveImportBatchStatus.PREVIEWED]: labels.leaveImportStatusPreviewed,
    [LeaveImportBatchStatus.COMMITTING]: labels.leaveImportStatusCommitting,
    [LeaveImportBatchStatus.COMMITTED]: labels.leaveImportStatusCommitted,
    [LeaveImportBatchStatus.FAILED]: labels.leaveImportStatusFailed,
    [LeaveImportBatchStatus.CANCELLED]: labels.leaveImportStatusCancelled,
  })[status];

export function LeaveImportBatchHistory({
  labels,
  batches,
  disabled,
  onOpen,
}: {
  labels: Record<string, string>;
  batches: LeaveImportBatch[];
  disabled: boolean;
  onOpen: (batchId: string) => void;
}) {
  if (batches.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <History size={15} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          {labels.leaveImportBatchHistory}
        </h3>
      </div>
      <div className="space-y-2">
        {batches.slice(0, 8).map((batch) => (
          <button
            key={batch.id}
            type="button"
            disabled={disabled}
            onClick={() => onOpen(batch.id)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-soft)] p-3 text-left disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {batch.source_file_name}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                {batch.valid_rows}/{batch.total_rows}{" "}
                {labels.leaveImportValidRows.toLowerCase()}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
              {statusLabel(batch.status, labels)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
