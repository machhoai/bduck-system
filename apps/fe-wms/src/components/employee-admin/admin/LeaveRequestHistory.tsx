"use client";

import {
  LeaveRequestStatus,
  LeaveRequestType,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";
import { CalendarDays, FileClock, XCircle } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useMemo, useState } from "react";
import { EmptyState } from "./AdminOverviewParts";
import { LeaveApprovalTimeline } from "./LeaveApprovalTimeline";
import { LeaveRequestFilters } from "./LeaveRequestFilters";

const statusKeys: Record<LeaveRequestStatus, string> = {
  [LeaveRequestStatus.DRAFT]: "leaveStatusDraft",
  [LeaveRequestStatus.PENDING_APPROVAL]: "leaveStatusPending",
  [LeaveRequestStatus.APPROVED]: "leaveStatusApproved",
  [LeaveRequestStatus.REJECTED]: "leaveStatusRejected",
  [LeaveRequestStatus.CANCELLED]: "leaveStatusCancelled",
  [LeaveRequestStatus.APPROVER_UNAVAILABLE]: "leaveStatusApproverUnavailable",
};
const typeKeys: Record<LeaveRequestType, string> = {
  [LeaveRequestType.PAID_ANNUAL]: "paidLeave",
  [LeaveRequestType.UNPAID]: "unpaidLeave",
  [LeaveRequestType.SICK]: "sickLeave",
  [LeaveRequestType.MATERNITY]: "maternityLeave",
};
const statusTone: Record<LeaveRequestStatus, string> = {
  [LeaveRequestStatus.DRAFT]: "bg-slate-100 text-slate-600",
  [LeaveRequestStatus.PENDING_APPROVAL]: "bg-amber-50 text-amber-700",
  [LeaveRequestStatus.APPROVED]: "bg-emerald-50 text-emerald-700",
  [LeaveRequestStatus.REJECTED]: "bg-red-50 text-red-700",
  [LeaveRequestStatus.CANCELLED]: "bg-slate-100 text-slate-500",
  [LeaveRequestStatus.APPROVER_UNAVAILABLE]: "bg-orange-50 text-orange-700",
};

interface LeaveRequestHistoryProps {
  labels: Record<string, string>;
  requests: LeaveRequest[];
  approvalTasks?: LeaveApprovalTask[];
  loading: boolean;
  error: string | null;
  compact?: boolean;
  canCreate: boolean;
  onSubmit: (requestId: string) => Promise<unknown>;
  onCancel: (requestId: string, reason: string) => Promise<unknown>;
}

export function LeaveRequestHistory({
  labels,
  requests,
  approvalTasks = [],
  loading,
  error,
  compact = false,
  canCreate,
  onSubmit,
  onCancel,
}: LeaveRequestHistoryProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          (statusFilter === "ALL" || request.status === statusFilter) &&
          (typeFilter === "ALL" || request.request_type === typeFilter),
      ),
    [requests, statusFilter, typeFilter],
  );
  const visibleRequests = compact
    ? filteredRequests.slice(0, 3)
    : filteredRequests;

  const runSubmit = async (requestId: string) => {
    if (busyId) return;
    setBusyId(requestId);
    try {
      await gooeyToast.promise(onSubmit(requestId), {
        loading: labels.submittingRequest,
        success: labels.submitRequestSuccess,
        error: labels.leaveRequestSaveError,
        description: {
          success: labels.submitRequestSuccessHint,
          error: labels.leaveRequestSaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void runSubmit(requestId),
          },
        },
      });
    } catch (actionError) {
      console.error("[LeaveRequestHistory] submit error:", actionError);
    } finally {
      setBusyId(null);
    }
  };

  const runCancel = async (requestId: string) => {
    if (busyId || !cancelReason.trim()) return;
    setBusyId(requestId);
    try {
      await gooeyToast.promise(onCancel(requestId, cancelReason.trim()), {
        loading: labels.cancellingRequest,
        success: labels.cancelRequestSuccess,
        error: labels.leaveRequestSaveError,
        description: {
          success: labels.cancelRequestSuccessHint,
          error: labels.leaveRequestSaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void runCancel(requestId),
          },
        },
      });
      setCancellingId(null);
      setCancelReason("");
    } catch (actionError) {
      console.error("[LeaveRequestHistory] cancel error:", actionError);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-card)]"
          />
        ))}
      </div>
    );
  }
  if (error && requests.length === 0) {
    return <EmptyState title={labels.leaveRequestsLoadError} hint={error} />;
  }
  if (requests.length === 0) {
    return (
      <EmptyState title={labels.noRequests} hint={labels.noRequestsHint} />
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <LeaveRequestFilters
          labels={labels}
          status={statusFilter}
          type={typeFilter}
          statusLabels={statusKeys}
          typeLabels={typeKeys}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
        />
      )}
      {visibleRequests.length === 0 && (
        <EmptyState title={labels.noRequests} hint={labels.noFilterResults} />
      )}
      {visibleRequests.map((request) => {
        const cancellable =
          request.status === LeaveRequestStatus.DRAFT ||
          request.status === LeaveRequestStatus.PENDING_APPROVAL;
        return (
          <article
            key={request.id}
            className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-3"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
                {request.status === LeaveRequestStatus.DRAFT ? (
                  <FileClock size={16} />
                ) : (
                  <CalendarDays size={16} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {labels[typeKeys[request.request_type]]}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[request.status]}`}
                  >
                    {labels[statusKeys[request.status]]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {request.days.map((day) => day.date).join(", ")}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                  {request.reason}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-[var(--color-brand-primary)]">
                {labels.totalLeaveUnits.replace(
                  "{units}",
                  String(request.total_units),
                )}
              </span>
            </div>

            {!compact && request.status !== LeaveRequestStatus.DRAFT && (
              <div className="mt-3 border-t border-[var(--color-border-soft)] pt-3">
                <LeaveApprovalTimeline
                  labels={labels}
                  tasks={approvalTasks.filter(
                    (task) =>
                      task.leave_request_id === request.id &&
                      task.approval_attempt === request.approval_attempt,
                  )}
                />
              </div>
            )}

            {canCreate && cancellable && (
              <div className="mt-3 border-t border-[var(--color-border-soft)] pt-2">
                {cancellingId === request.id ? (
                  <div className="space-y-2">
                    <input
                      value={cancelReason}
                      disabled={busyId === request.id}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder={labels.cancelReasonPlaceholder}
                      className="h-10 w-full rounded-xl border border-[var(--color-border-soft)] px-3 text-xs outline-none focus:border-[var(--color-brand-primary)]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => setCancellingId(null)}
                        className="h-9 rounded-xl border border-[var(--color-border-soft)] text-xs font-semibold"
                      >
                        {labels.back}
                      </button>
                      <button
                        type="button"
                        disabled={
                          busyId === request.id || !cancelReason.trim()
                        }
                        onClick={() => void runCancel(request.id)}
                        className="h-9 rounded-xl bg-red-600 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {labels.confirmCancelRequest}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => setCancellingId(request.id)}
                      className="flex h-9 items-center gap-1.5 rounded-xl border border-red-100 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      {labels.cancelRequest}
                    </button>
                    {request.status === LeaveRequestStatus.DRAFT && (
                      <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => void runSubmit(request.id)}
                        className="h-9 rounded-xl bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {labels.submitRequest}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
