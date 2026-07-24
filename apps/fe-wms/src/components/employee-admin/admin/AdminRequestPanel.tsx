"use client";

import type { LeaveRequest, LeaveRequestType } from "@bduck/shared-types";
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
import { LeaveRequestHistory } from "./LeaveRequestHistory";

interface AdminRequestPanelProps {
  labels: Record<string, string>;
  requests: LeaveRequest[];
  loading: boolean;
  error: string | null;
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
  onSubmit: (requestId: string) => Promise<unknown>;
  onCancel: (requestId: string, reason: string) => Promise<unknown>;
}

export function AdminRequestPanel({
  labels,
  requests,
  loading,
  error,
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
  onSubmit,
  onCancel,
}: AdminRequestPanelProps) {
  return (
    <section
      data-employee-admin-animate
      className="rounded-[28px] border border-white/80 bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:p-5 lg:shadow-none"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {labels.adminRequests}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
            {labels.quickActions}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {canApprove && (
            <button
              type="button"
              onClick={onOpenApprovals}
              aria-label={labels.approvalInboxTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
            >
              <ClipboardCheck size={17} />
            </button>
          )}
          {canReassign && (
            <button
              type="button"
              onClick={onOpenUnavailable}
              aria-label={labels.approvalUnavailableTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-amber-700 hover:bg-amber-50"
            >
              <UserRoundX size={17} />
            </button>
          )}
          {canManageApproval && (
            <button
              type="button"
              onClick={onOpenPolicy}
              aria-label={labels.leavePolicyTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
            >
              <BookOpenCheck size={17} />
            </button>
          )}
          {canReadAll && (
            <button
              type="button"
              onClick={onOpenCompanyRequests}
              aria-label={labels.companyLeaveRequestsTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
            >
              <Users size={17} />
            </button>
          )}
          {canAdjustBalance && (
            <button
              type="button"
              onClick={onOpenBalanceAdjustment}
              aria-label={labels.leaveBalanceAdjustmentTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-violet-700 hover:bg-violet-50"
            >
              <Scale size={17} />
            </button>
          )}
          {canManageApproval && (
            <button
              type="button"
              onClick={onOpenApprovalConfig}
              aria-label={labels.approvalConfigTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
            >
              <Settings2 size={17} />
            </button>
          )}
          {canManageHolidays && (
            <button
              type="button"
              onClick={onOpenHolidays}
              aria-label={labels.manageCompanyHolidays}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
            >
              <CalendarCog size={17} />
            </button>
          )}
          {canImportHistory && (
            <button
              type="button"
              onClick={onOpenImport}
              aria-label={labels.leaveImportTitle}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-50"
            >
              <FileUp size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={labels.viewRequestHistory}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
          >
            <History size={17} />
          </button>
          <ClipboardList
            className="text-[var(--color-brand-primary)]"
            size={18}
          />
        </div>
      </div>

      {canCreate && (
        <AdminRequestActions labels={labels} onSelect={onCreate} />
      )}
      <div className="mt-4">
        <LeaveRequestHistory
          labels={labels}
          requests={requests}
          loading={loading}
          error={error}
          compact
          canCreate={canCreate}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </div>
    </section>
  );
}
