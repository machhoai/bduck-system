"use client";

import type {
  DecideLeaveApprovalTaskInput,
  LeaveDayPortion,
  LeaveApprovalTaskView,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useState } from "react";
import { EmptyState } from "./AdminOverviewParts";

interface Props {
  labels: Record<string, string>;
  tasks: LeaveApprovalTaskView[];
  loading: boolean;
  error: string | null;
  onDecide: (
    taskId: string,
    input: DecideLeaveApprovalTaskInput,
  ) => Promise<unknown>;
}

const portionLabelKey: Record<LeaveDayPortion, string> = {
  FULL_DAY: "fullDay",
  MORNING: "morning",
  AFTERNOON: "afternoon",
};

export function LeaveApprovalInbox({
  labels,
  tasks,
  loading,
  error,
  onDecide,
}: Props) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const decide = async (
    view: LeaveApprovalTaskView,
    decision: "APPROVE" | "REJECT",
  ) => {
    if (busyId) return;
    const reason = reasons[view.task.id]?.trim() ?? "";
    if (decision === "REJECT" && !reason) {
      gooeyToast.error(labels.approvalRejectReasonRequired, {
        preset: "snappy",
      });
      return;
    }
    const retry = () => void decide(view, decision);
    setBusyId(view.task.id);
    try {
      await gooeyToast.promise(
        onDecide(view.task.id, {
          decision,
          reason,
          action_time: new Date(),
        }),
        {
          loading: labels.approvalDecisionSaving,
          success:
            decision === "APPROVE"
              ? labels.approvalApproved
              : labels.approvalRejected,
          error: labels.approvalSaveError,
          action: { error: { label: labels.retry, onClick: retry } },
        },
      );
    } catch (saveError) {
      console.error("[LeaveApprovalInbox] decision error:", saveError);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-surface-card)]" />;
  }
  if (error) {
    return <p className="rounded-2xl bg-red-50 p-3 text-xs text-red-700">{error}</p>;
  }
  if (!tasks.length) {
    return (
      <EmptyState
        title={labels.approvalInboxEmpty}
        hint={labels.approvalInboxEmptyHint}
      />
    );
  }
  return (
    <div className="space-y-3">
      {tasks.map((view) => (
        <section
          key={view.task.id}
          className="rounded-2xl border border-[var(--color-border-soft)] p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {view.employee_name || view.employee_code}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {view.employee_code} · {labels.approvalLevel.replace(
                  "{level}",
                  String(view.task.level),
                )}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
              {view.request.total_units} {labels.leaveUnitShort}
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {view.request.reason}
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {view.request.days
              .map(
                (day) =>
                  `${day.date} (${labels[portionLabelKey[day.portion]]})`,
              )
              .join(", ")}
          </p>
          <textarea
            value={reasons[view.task.id] ?? ""}
            disabled={busyId === view.task.id}
            placeholder={labels.approvalDecisionReasonPlaceholder}
            onChange={(event) =>
              setReasons((current) => ({
                ...current,
                [view.task.id]: event.target.value,
              }))
            }
            className="mt-3 min-h-20 w-full rounded-xl border border-[var(--color-border-soft)] p-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void decide(view, "REJECT")}
              className="h-10 rounded-xl border border-red-200 text-sm font-semibold text-red-700 disabled:opacity-50"
            >
              {labels.approvalReject}
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void decide(view, "APPROVE")}
              className="h-10 rounded-xl bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
            >
              {labels.approvalApprove}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
