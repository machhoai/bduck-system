import {
  LeaveApprovalTaskStatus,
  type LeaveApprovalTask,
} from "@bduck/shared-types";
import { Check, Clock3, Minus, UserRoundX, X } from "lucide-react";

const statusKeys: Record<LeaveApprovalTaskStatus, string> = {
  [LeaveApprovalTaskStatus.WAITING]: "approvalStatusWaiting",
  [LeaveApprovalTaskStatus.PENDING]: "approvalStatusPending",
  [LeaveApprovalTaskStatus.APPROVED]: "approvalStatusApproved",
  [LeaveApprovalTaskStatus.REJECTED]: "approvalStatusRejected",
  [LeaveApprovalTaskStatus.CANCELLED]: "approvalStatusCancelled",
  [LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE]:
    "approvalStatusUnavailable",
};

const statusIcons = {
  [LeaveApprovalTaskStatus.WAITING]: Minus,
  [LeaveApprovalTaskStatus.PENDING]: Clock3,
  [LeaveApprovalTaskStatus.APPROVED]: Check,
  [LeaveApprovalTaskStatus.REJECTED]: X,
  [LeaveApprovalTaskStatus.CANCELLED]: Minus,
  [LeaveApprovalTaskStatus.APPROVER_UNAVAILABLE]: UserRoundX,
};

export function LeaveApprovalTimeline({
  labels,
  tasks,
}: {
  labels: Record<string, string>;
  tasks: LeaveApprovalTask[];
}) {
  if (!tasks.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        {labels.approvalTimelineEmpty}
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {[...tasks]
        .sort((left, right) => left.level - right.level)
        .map((task) => {
          const Icon = statusIcons[task.status];
          const label =
            labels.localeCode === "zh" ? task.label.zh : task.label.vi;
          return (
            <li key={task.id} className="flex gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
                <Icon size={12} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {labels.approvalLevelLabel
                    .replace("{level}", String(task.level))
                    .replace("{label}", label)}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {labels[statusKeys[task.status]]}
                  {task.decision_reason ? ` · ${task.decision_reason}` : ""}
                </p>
              </div>
            </li>
          );
        })}
    </ol>
  );
}
