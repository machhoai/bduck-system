"use client";

import type { LeaveRequestType } from "@bduck/shared-types";
import {
    CalendarCog,
    BookOpenCheck,
    ClipboardCheck,
    ClipboardList,
    History,
    FileUp,
    Settings2,
    Scale,
    Users,
    UserRoundX,
} from "lucide-react";

import { AdminRequestActions } from "./AdminRequestActions";

interface AdminRequestPanelProps {
    labels: Record<string, string>;
    canCreate: boolean;
    canManageHolidays: boolean;
    canApprove: boolean;
    canManageApproval: boolean;
    canReassign: boolean;
    canImportHistory: boolean;
    canReadAll: boolean;
    canAdjustBalance: boolean;
    onCreate: (requestType: LeaveRequestType) => void;
    onOpenHistory: () => void;
    onOpenHolidays: () => void;
    onOpenApprovals: () => void;
    onOpenApprovalConfig: () => void;
    onOpenUnavailable: () => void;
    onOpenImport: () => void;
    onOpenPolicy: () => void;
    onOpenCompanyRequests: () => void;
    onOpenBalanceAdjustment: () => void;
}

export function AdminRequestPanel({
    labels,
    canCreate,
    canManageHolidays,
    canApprove,
    canManageApproval,
    canReassign,
    canImportHistory,
    canReadAll,
    canAdjustBalance,
    onCreate,
    onOpenHistory,
    onOpenHolidays,
    onOpenApprovals,
    onOpenApprovalConfig,
    onOpenUnavailable,
    onOpenImport,
    onOpenPolicy,
    onOpenCompanyRequests,
    onOpenBalanceAdjustment,
}: AdminRequestPanelProps) {
    const hasAdminActions =
        canApprove ||
        canReassign ||
        canManageApproval ||
        canReadAll ||
        canAdjustBalance ||
        canManageHolidays ||
        canImportHistory;

    return (
        <section
            data-employee-admin-animate
            className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-xs lg:p-5"
        >
            {/* Standardized Header */}
            <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                        <ClipboardList size={15} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                            {labels.quickActions || "Tạo yêu cầu & Quản trị"}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Admin Quick Toolbar - High-density chip buttons with Text Labels + Icons */}
            {hasAdminActions && (
                <div className="grid grid-cols-3 items-center gap-1.5">
                    {canApprove && (
                        <button
                            type="button"
                            onClick={onOpenApprovals}
                            title={labels.approvalInboxTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-blue-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 shadow-2xs transition-all hover:bg-blue-50 active:scale-95 cursor-pointer"
                        >
                            <ClipboardCheck size={14} />
                            <span className="hidden md:block">{labels.approvalInboxTitle}</span>
                        </button>
                    )}
                    {canReassign && (
                        <button
                            type="button"
                            onClick={onOpenUnavailable}
                            title={labels.approvalUnavailableTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-amber-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-amber-700 shadow-2xs transition-all hover:bg-amber-50 active:scale-95 cursor-pointer"
                        >
                            <UserRoundX size={14} />
                            <span className="hidden md:block">{labels.approvalUnavailableTitle}</span>
                        </button>
                    )}
                    {canManageApproval && (
                        <button
                            type="button"
                            onClick={onOpenPolicy}
                            title={labels.leavePolicyTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
                        >
                            <BookOpenCheck size={14} />
                            <span className="hidden md:block">{labels.leavePolicyTitle}</span>
                        </button>
                    )}
                    {canReadAll && (
                        <button
                            type="button"
                            onClick={onOpenCompanyRequests}
                            title={labels.companyLeaveRequestsTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
                        >
                            <Users size={14} />
                            <span className="hidden md:block">{labels.companyLeaveRequestsTitle}</span>
                        </button>
                    )}
                    {canAdjustBalance && (
                        <button
                            type="button"
                            onClick={onOpenBalanceAdjustment}
                            title={labels.leaveBalanceAdjustmentTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-violet-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-violet-700 shadow-2xs transition-all hover:bg-violet-50 active:scale-95 cursor-pointer"
                        >
                            <Scale size={14} />
                            <span className="hidden md:block">{labels.leaveBalanceAdjustmentTitle}</span>
                        </button>
                    )}
                    {canManageApproval && (
                        <button
                            type="button"
                            onClick={onOpenApprovalConfig}
                            title={labels.approvalConfigTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
                        >
                            <Settings2 size={14} />
                            <span className="hidden md:block">{labels.approvalConfigTitle}</span>
                        </button>
                    )}
                    {canManageHolidays && (
                        <button
                            type="button"
                            onClick={onOpenHolidays}
                            title={labels.manageCompanyHolidays}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
                        >
                            <CalendarCog size={14} />
                            <span className="hidden md:block">{labels.manageCompanyHolidays}</span>
                        </button>
                    )}
                    {canImportHistory && (
                        <button
                            type="button"
                            onClick={onOpenImport}
                            title={labels.leaveImportTitle}
                            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-emerald-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs transition-all hover:bg-emerald-50 active:scale-95 cursor-pointer"
                        >
                            <FileUp size={14} />
                            <span className="hidden md:block">{labels.leaveImportTitle}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onOpenHistory}
                        title={labels.viewRequestHistory}
                        className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
                    >
                        <History size={14} />
                        <span className="hidden md:block">{labels.viewRequestHistory}</span>
                    </button>
                </div>
            )}

            {canCreate && (
                <AdminRequestActions labels={labels} onSelect={onCreate} />
            )}
        </section>
    );
}
