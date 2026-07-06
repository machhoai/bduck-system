"use client";

import { AttendanceLogStatus, type AttendanceLog } from "@bduck/shared-types";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { formatCheckInTime } from "@/utils/attendance";

interface AttendanceAuditLogProps {
    labels: Record<string, string>;
    logs: AttendanceLog[];
    canView: boolean;
}

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getAvatarBg = (name: string) => {
    const colors = [
        "bg-[#0066cc10] text-[#0066cc]",
        "bg-[#257a3e10] text-[#257a3e]",
        "bg-[#93600010] text-[#936000]",
        "bg-[#7928ca10] text-[#7928ca]",
        "bg-[#ff007f10] text-[#ff007f]",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

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

    const isVi = labels.allEmployees?.toLowerCase().includes("nhân viên") || labels.calendar?.toLowerCase().includes("lịch");
    const txtInvalidNetwork = isVi ? "Ngoài mạng công ty" : "非公司网络";

    return (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)]  p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b4231810] text-[#b42318]">
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
                <span className="rounded-full bg-[#b4231810] border border-[#b4231820] px-2.5 py-0.5 text-xxs font-semibold text-[#b42318] shadow-sm">
                    {rejectedLogs.length}
                </span>
            </div>

            <div className="max-h-72 overflow-auto p-2 scrollbar-thin">
                {rejectedLogs.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--color-text-muted)]">
                        <AlertTriangle size={14} />
                        <span>{labels.noRejectedLogs}</span>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {rejectedLogs.map((log) => (
                            <div
                                key={log.id}
                                className="flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] last:border-b-0 p-2.5 hover:bg-slate-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xxs font-bold ${getAvatarBg(log.employee_name)}`}>
                                        {getInitials(log.employee_name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                                {log.employee_name}
                                            </span>
                                            <span className="text-micro text-[var(--color-text-muted)] bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                                {log.employee_id}
                                            </span>
                                        </div>
                                        <p className="text-micro text-[var(--color-text-muted)] mt-0.5">
                                            {log.attendance_date}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <span className="text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                                        {formatCheckInTime(log.check_in_at)}
                                    </span>
                                    <span
                                        className="inline-flex items-center gap-1.5 rounded bg-[#b423180a] border border-[#b4231815] px-2 py-0.5 text-micro font-semibold text-[#b42318]"
                                        title={labels.companyNetworkRequired}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#b42318] animate-pulse" />
                                        {txtInvalidNetwork}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
