"use client";

import { AttendanceLogStatus, type AttendanceLog } from "@bduck/shared-types";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { formatCheckInTime } from "@/utils/attendance";

interface AttendanceAuditLogProps {
  labels: Record<string, string>;
  logs: AttendanceLog[];
  canView: boolean;
}

export function AttendanceAuditLog({
  labels,
  logs,
  canView,
}: AttendanceAuditLogProps) {
  if (!canView) return null;

  const rejectedLogs = logs
    .filter((log) => log.status === AttendanceLogStatus.REJECTED)
    .sort((a, b) => String(b.check_in_at).localeCompare(String(a.check_in_at)))
    .slice(0, 40);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[#b4231812] text-[#b42318]">
            <ShieldAlert size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {labels.rejectedAudit}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {labels.rejectedAuditHint}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[#b4231812] px-3 py-1 text-xs font-semibold text-[#b42318]">
          {rejectedLogs.length}
        </span>
      </div>

      <div className="max-h-72 overflow-auto p-2">
        {rejectedLogs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--color-text-muted)]">
            <AlertTriangle size={14} />
            <span>{labels.noRejectedLogs}</span>
          </div>
        ) : (
          rejectedLogs.map((log) => (
            <div
              key={log.id}
              className="grid gap-2 rounded-[var(--radius-sm)] p-3 transition-colors hover:bg-[var(--color-surface-card)] sm:grid-cols-[1fr_130px_130px]"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                  {log.employee_name}
                </p>
                <p className="truncate text-micro text-[var(--color-text-muted)]">
                  {log.employee_id} · {log.attendance_date}
                </p>
              </div>
              <div className="text-xs tabular-nums text-[var(--color-text-secondary)]">
                {formatCheckInTime(log.check_in_at)}
              </div>
              <div className="truncate text-xs text-[#b42318]">
                {labels.companyNetworkRequired}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
