"use client";

import { useMemo } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  PenSquare,
  ShieldAlert,
  Trash2,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useAuditNameResolver } from "@/hooks/useAuditNameResolver";
import { useTranslation } from "@/lib/i18n";
import { formatAuditDate } from "@/utils/auditLogFilters";
import {
  getAuditLogPresentation,
  type AuditLogPresentationLabels,
} from "@/utils/auditLogPresentation";

interface WarehouseAuditCardProps {
  warehouseId: string;
}

const actionStyles: Record<string, { icon: LucideIcon; color: string }> = {
  CREATE: {
    icon: ClipboardList,
    color: "border-[var(--color-status-completed-border)] bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
  },
  UPDATE: {
    icon: PenSquare,
    color: "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
  },
  APPROVE: {
    icon: CheckCircle2,
    color: "border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
  },
  REJECT: {
    icon: XCircle,
    color: "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
  },
  CANCEL: {
    icon: XCircle,
    color: "border-[var(--color-status-draft-border)] bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]",
  },
  SOFT_DELETE: {
    icon: Trash2,
    color: "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
  },
  QUARANTINE: {
    icon: ShieldAlert,
    color: "border-[var(--color-status-export-border)] bg-[var(--color-status-export-bg)] text-[var(--color-status-export-text)]",
  },
  RELEASE: {
    icon: Undo2,
    color: "border-[var(--color-status-transit-border)] bg-[var(--color-status-transit-bg)] text-[var(--color-status-transit-text)]",
  },
  TRANSFER: {
    icon: ArrowRightLeft,
    color: "border-[var(--color-status-picking-border)] bg-[var(--color-status-picking-bg)] text-[var(--color-status-picking-text)]",
  },
};

const fallbackStyle = {
  icon: ClipboardList,
  color:
    "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)]",
};

export function WarehouseAuditCard({ warehouseId }: WarehouseAuditCardProps) {
  const { t } = useTranslation();
  const { logs, isLoading, error } = useAuditLogs({ warehouseId, limit: 8 });
  const scopedLogs = useMemo(
    () => logs.filter((log) => log.warehouse_id === warehouseId).slice(0, 6),
    [logs, warehouseId],
  );
  const resolver = useAuditNameResolver(scopedLogs);

  const labels: AuditLogPresentationLabels = {
    actionLabels: t.auditLog.actionLabels,
    entityLabels: t.auditLog.entityLabels,
    pageLabels: t.auditLog.pageLabels,
    record: t.auditLog.record,
    unknownPage: t.auditLog.unknownPage,
    unknownUser: t.auditLog.unknownUser,
    changedFields: t.auditLog.changedFields,
    noChangedFields: t.auditLog.noChangedFields,
  };

  return (
    <div className="flex max-h-[400px] flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t.warehouses.recentActivity}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="relative ml-3 space-y-4 border-l border-[var(--color-border-subtle)] pb-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="relative pl-6">
                <div className="absolute -left-[17px] h-[34px] w-[34px] animate-pulse rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]" />
                <div className="space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded bg-[var(--color-surface-card)]" />
                  <div className="h-3 w-[min(260px,100%)] animate-pulse rounded bg-[var(--color-surface-card)]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
            {t.common.error}: {error}
          </div>
        ) : scopedLogs.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
            {t.common.noData}
          </div>
        ) : (
          <div className="relative ml-3 space-y-4 border-l border-[var(--color-border-subtle)] pb-2">
            {scopedLogs.map((log) => {
              const presentation = getAuditLogPresentation(
                log,
                labels,
                resolver,
              );
              const style = actionStyles[log.action] || fallbackStyle;
              const Icon = style.icon;

              return (
                <div key={log.id} className="relative pl-6">
                  <div
                    className={`absolute -left-[17px] flex h-[34px] w-[34px] items-center justify-center rounded-full border ${style.color}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold leading-5 text-[var(--color-text-primary)]">
                        {presentation.actor}
                      </span>
                      <span className="text-xs leading-5 text-[var(--color-text-muted)]">
                        {formatAuditDate(log.action_time)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--color-text-secondary)]">
                      {presentation.summary}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {presentation.action} / {presentation.entity} /{" "}
                      {presentation.changedText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
