import {
  LeaveLedgerEntryType,
  type LeaveBalanceSummary,
} from "@bduck/shared-types";
import { CalendarDays, LockKeyhole } from "lucide-react";
import { EmptyState } from "./AdminOverviewParts";

const labelKeyByType: Record<LeaveLedgerEntryType, string> = {
  [LeaveLedgerEntryType.MONTHLY_ACCRUAL]: "monthlyAccrual",
  [LeaveLedgerEntryType.PROBATION_ACCRUAL]: "probationAccrual",
  [LeaveLedgerEntryType.PROBATION_RELEASE]: "probationRelease",
  [LeaveLedgerEntryType.REQUEST_HOLD]: "requestHold",
  [LeaveLedgerEntryType.REQUEST_APPROVED]: "requestApproved",
  [LeaveLedgerEntryType.REQUEST_RELEASED]: "requestReleased",
  [LeaveLedgerEntryType.YEAR_END_EXPIRED]: "yearEndExpired",
  [LeaveLedgerEntryType.HISTORICAL_IMPORT]: "historicalImport",
  [LeaveLedgerEntryType.MANUAL_ADJUSTMENT]: "manualAdjustment",
};

const entryUnits = (entry: LeaveBalanceSummary["recent_entries"][number]) => {
  const values = Object.values(entry.delta).map((value) => Math.abs(value));
  const units = Math.max(...values, 0);
  const prefix =
    entry.entry_type === LeaveLedgerEntryType.YEAR_END_EXPIRED ? "-" : "+";
  return `${prefix}${units.toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  })}`;
};

export function LeaveBalanceHistory({
  labels,
  summary,
}: {
  labels: Record<string, string>;
  summary: LeaveBalanceSummary | null;
}) {
  if (!summary || summary.recent_entries.length === 0) {
    return (
      <EmptyState
        title={labels.leaveLedgerEmpty}
        hint={labels.leaveBalanceHint}
      />
    );
  }

  return (
    <div className="space-y-2">
      {summary.recent_entries.map((entry) => (
        <article
          key={entry.id}
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-white p-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
            {entry.entry_type === LeaveLedgerEntryType.PROBATION_ACCRUAL ? (
              <LockKeyhole size={16} />
            ) : (
              <CalendarDays size={16} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {labels[labelKeyByType[entry.entry_type]]}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {entry.posting_date} ·{" "}
              {labels.leaveYear.replace("{year}", String(entry.leave_year))}
            </p>
          </div>
          <span
            className={`text-sm font-bold ${
              entry.entry_type === LeaveLedgerEntryType.YEAR_END_EXPIRED
                ? "text-[#b42318]"
                : "text-[#257a3e]"
            }`}
          >
            {entryUnits(entry)}
          </span>
        </article>
      ))}
    </div>
  );
}
