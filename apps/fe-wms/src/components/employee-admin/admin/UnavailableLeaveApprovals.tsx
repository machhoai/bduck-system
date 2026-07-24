"use client";

import type {
  LeaveApprovalAssignment,
  LeaveApprovalConfigOptions,
  LeaveApprovalTaskView,
  ReassignLeaveApprovalTaskInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useState } from "react";
import { EmptyState } from "./AdminOverviewParts";

interface Draft {
  mode: "ROLE" | "USER";
  targetId: string;
  reason: string;
}

interface Props {
  labels: Record<string, string>;
  tasks: LeaveApprovalTaskView[];
  options: LeaveApprovalConfigOptions;
  loading: boolean;
  error: string | null;
  onReassign: (
    taskId: string,
    input: ReassignLeaveApprovalTaskInput,
  ) => Promise<unknown>;
}

const defaultDraft = (options: LeaveApprovalConfigOptions): Draft =>
  options.roles[0]
    ? { mode: "ROLE", targetId: options.roles[0].id, reason: "" }
    : { mode: "USER", targetId: options.users[0]?.id ?? "", reason: "" };

const assignmentFor = (draft: Draft): LeaveApprovalAssignment =>
  draft.mode === "ROLE"
    ? { mode: "ROLE", role_id: draft.targetId, assigned_user_id: null }
    : { mode: "USER", role_id: null, assigned_user_id: draft.targetId };

export function UnavailableLeaveApprovals({
  labels,
  tasks,
  options,
  loading,
  error,
  onReassign,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const getDraft = (id: string) => drafts[id] ?? defaultDraft(options);
  const patchDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [id]: { ...getDraft(id), ...patch },
    }));

  const submit = async (view: LeaveApprovalTaskView) => {
    if (busyId) return;
    const draft = getDraft(view.task.id);
    if (!draft.targetId || !draft.reason.trim()) {
      gooeyToast.error(labels.approvalReassignRequired, { preset: "snappy" });
      return;
    }
    setBusyId(view.task.id);
    try {
      await gooeyToast.promise(
        onReassign(view.task.id, {
          assignment: assignmentFor(draft),
          reason: draft.reason.trim(),
          action_time: new Date(),
        }),
        {
          loading: labels.approvalReassigning,
          success: labels.approvalReassigned,
          error: labels.approvalSaveError,
          action: {
            error: {
              label: labels.retry,
              onClick: () => void submit(view),
            },
          },
        },
      );
    } catch (saveError) {
      console.error("[UnavailableLeaveApprovals] reassign error:", saveError);
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
        title={labels.approvalUnavailableEmpty}
        hint={labels.approvalUnavailableEmptyHint}
      />
    );
  }
  return (
    <div className="space-y-3">
      {tasks.map((view) => {
        const draft = getDraft(view.task.id);
        const targets =
          draft.mode === "ROLE" ? options.roles : options.users;
        return (
          <section
            key={view.task.id}
            className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3"
          >
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {view.employee_name || view.employee_code}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {view.employee_code} · {labels.approvalLevel.replace(
                "{level}",
                String(view.task.level),
              )}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                value={draft.mode}
                disabled={busyId === view.task.id}
                onChange={(event) => {
                  const mode = event.target.value as "ROLE" | "USER";
                  patchDraft(view.task.id, {
                    mode,
                    targetId:
                      mode === "ROLE"
                        ? options.roles[0]?.id ?? ""
                        : options.users[0]?.id ?? "",
                  });
                }}
                className="h-10 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
              >
                <option value="ROLE">{labels.approvalByRole}</option>
                <option value="USER">{labels.approvalByUser}</option>
              </select>
              <select
                value={draft.targetId}
                disabled={busyId === view.task.id}
                onChange={(event) =>
                  patchDraft(view.task.id, { targetId: event.target.value })
                }
                className="h-10 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
              >
                {targets.map((option) => (
                  <option key={option.id} value={option.id}>
                    {"name" in option
                      ? option.name
                      : `${option.full_name} (${option.employee_id})`}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={draft.reason}
              disabled={busyId === view.task.id}
              placeholder={labels.approvalReassignReasonPlaceholder}
              onChange={(event) =>
                patchDraft(view.task.id, { reason: event.target.value })
              }
              className="mt-2 min-h-20 w-full rounded-xl border border-[var(--color-border-soft)] bg-white p-3 text-sm"
            />
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void submit(view)}
              className="mt-2 h-10 w-full rounded-xl bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
            >
              {labels.approvalReassign}
            </button>
          </section>
        );
      })}
    </div>
  );
}
