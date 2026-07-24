import type { LeaveBalanceSummary } from "@bduck/shared-types";
import { ListRestart, Plus, ShieldCheck } from "lucide-react";
import { MetricTile } from "./AdminOverviewParts";

const formatUnits = (value: number | undefined) =>
  (value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

export function LeaveBalanceCard({
  labels,
  summary,
  loading,
  error,
  canView,
  canRequest,
  onHistory,
  onRequest,
}: {
  labels: Record<string, string>;
  summary: LeaveBalanceSummary | null;
  loading: boolean;
  error: string | null;
  canView: boolean;
  canRequest: boolean;
  onHistory: () => void;
  onRequest: () => void;
}) {
  const currentYear = Number(summary?.as_of_date.slice(0, 4));
  const carryover = summary?.buckets.find(
    (bucket) => bucket.leave_year === currentYear - 1,
  );
  return (
    <section
      data-employee-admin-animate
      className="rounded-[28px] border border-white/80 bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:p-5 lg:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {labels.leaveBalance}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
            {labels.leaveBalanceTitle}
          </h2>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#257a3e10] text-[#257a3e]">
          <ShieldCheck size={18} />
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-2xl bg-[var(--color-surface-card)]"
            />
          ))}
        </div>
      ) : canView && summary ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricTile
              label={labels.availableLeave}
              value={formatUnits(summary.available_units)}
              tone="success"
            />
            <MetricTile
              label={labels.pendingLeave}
              value={formatUnits(summary.held_units)}
            />
            <MetricTile
              label={labels.usedLeave}
              value={formatUnits(summary.used_units)}
              tone="warning"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface-card)] px-3 py-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {labels.probationLeave}
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {formatUnits(summary.pending_probation_units)}
            </span>
          </div>
          {carryover && carryover.available_units > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-3 py-2">
              <span className="text-xs text-amber-800">
                {labels.carryoverLeaveExpiry.replace(
                  "{date}",
                  `31/03/${currentYear}`,
                )}
              </span>
              <span className="text-sm font-bold text-amber-900">
                {formatUnits(carryover.available_units)}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-[var(--color-surface-card)] px-3 py-3 text-xs text-[var(--color-text-muted)]">
          {error || labels.leaveBalanceNoAccess}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
        {labels.leaveBalanceHint}
      </p>

      {canView && (
        <button
          type="button"
          onClick={onHistory}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-white px-4 text-xs font-bold text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-[0.98]"
        >
          <ListRestart size={14} />
          <span>{labels.viewLeaveHistory}</span>
        </button>
      )}

      {canRequest && (
        <button
          type="button"
          onClick={onRequest}
          className="mt-4 inline-flex h-9 w-fit items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand-primary)] px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] lg:w-full"
        >
          <Plus size={14} />
          <span>{labels.createRequest}</span>
        </button>
      )}
    </section>
  );
}
