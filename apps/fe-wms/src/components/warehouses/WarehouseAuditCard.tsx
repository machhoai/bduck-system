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
    color: "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
  UPDATE: {
    icon: PenSquare,
    color: "border-amber-100 bg-amber-50 text-amber-700",
  },
  APPROVE: {
    icon: CheckCircle2,
    color: "border-green-100 bg-green-50 text-green-700",
  },
  REJECT: {
    icon: XCircle,
    color: "border-rose-100 bg-rose-50 text-rose-600",
  },
  CANCEL: {
    icon: XCircle,
    color: "border-slate-200 bg-slate-50 text-slate-600",
  },
  SOFT_DELETE: {
    icon: Trash2,
    color: "border-rose-100 bg-rose-50 text-rose-600",
  },
  QUARANTINE: {
    icon: ShieldAlert,
    color: "border-orange-100 bg-orange-50 text-orange-700",
  },
  RELEASE: {
    icon: Undo2,
    color: "border-sky-100 bg-sky-50 text-sky-700",
  },
  TRANSFER: {
    icon: ArrowRightLeft,
    color: "border-indigo-100 bg-indigo-50 text-indigo-700",
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
    <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
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
          <div className="rounded-[var(--radius-md)] border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
