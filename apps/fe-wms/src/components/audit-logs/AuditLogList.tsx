import { ChevronRight, FileClock, MapPinned, UserRound } from "lucide-react";
import type { AuditLog } from "@bduck/shared-types";
import { formatAuditDate } from "@/utils/auditLogFilters";
import {
  getAuditLogPresentation,
  type AuditLogPresentationLabels,
} from "@/utils/auditLogPresentation";

interface AuditLogListProps {
  logs: AuditLog[];
  selectedId?: string;
  labels: {
    empty: string;
    emptyHint: string;
    changedFields: string;
    actionTime: string;
    syncTime: string;
    operation: string;
    performedBy: string;
    warehouseId: string;
    summary: string;
    page: string;
    record: string;
    unknownPage: string;
    unknownUser: string;
    noChangedFields: string;
    actionLabels: Record<string, string>;
    entityLabels: Record<string, string>;
    pageLabels: Record<string, string>;
  };
  onSelect: (log: AuditLog) => void;
}

const actionTone: Record<string, string> = {
  CREATE:
    "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]",
  UPDATE: "border-[var(--color-accent-info)] text-[var(--color-accent-info)]",
  SOFT_DELETE:
    "border-[var(--color-accent-error)] text-[var(--color-accent-error)]",
  DELETE: "border-[var(--color-accent-error)] text-[var(--color-accent-error)]",
  APPROVE:
    "border-[var(--color-accent-success)] text-[var(--color-accent-success)]",
  REJECT: "border-[var(--color-accent-error)] text-[var(--color-accent-error)]",
  CANCEL:
    "border-[var(--color-accent-warning)] text-[var(--color-accent-warning)]",
  QUARANTINE:
    "border-[var(--color-accent-warning)] text-[var(--color-accent-warning)]",
  RELEASE:
    "border-[var(--color-accent-success)] text-[var(--color-accent-success)]",
  TRANSFER:
    "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]",
};

export function AuditLogList({
  logs,
  selectedId,
  labels,
  onSelect,
}: AuditLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-white p-8 text-center">
        <FileClock size={44} className="mb-3 text-[var(--color-text-muted)]" />
        <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
          {labels.empty}
        </h3>
        <p className="mt-1 text-[17px] text-[var(--color-text-muted)]">
          {labels.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white">
      {logs.map((log) => {
        const isSelected = selectedId === log.id;
        const presentation = getAuditLogPresentation(
          log,
          labels as AuditLogPresentationLabels,
        );
        const rowClassName = `grid w-full gap-3 border-b border-[var(--color-border-soft)] px-4 py-4 text-left transition-colors last:border-b-0 lg:grid-cols-[minmax(0,1fr)_160px_32px] lg:items-center ${
          isSelected
            ? "bg-[var(--color-brand-primary-muted)]"
            : "hover:bg-[var(--color-surface-card)]"
        }`;
        const actionClassName = `inline-flex h-8 max-w-full items-center rounded-full border px-3 text-xs font-semibold ${
          actionTone[log.action] ||
          "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
        }`;

        return (
          <button
            key={log.id}
            type="button"
            onClick={() => onSelect(log)}
            className={rowClassName}
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className={actionClassName}>{presentation.action}</span>
                <span className="inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-[var(--color-border-soft)] px-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                  <MapPinned size={13} />
                  <span className="truncate">{presentation.page}</span>
                </span>
              </span>
              <span className="mt-2 block text-[17px] font-semibold leading-snug text-[var(--color-text-primary)]">
                {presentation.summary}
              </span>
              <span className="mt-2 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserRound size={14} />
                  <span className="shrink-0">{labels.performedBy}:</span>
                  <span className="truncate text-[var(--color-text-secondary)]">
                    {presentation.actor}
                  </span>
                </span>
                <span className="truncate">
                  {labels.record}: {presentation.entity} / {presentation.record}
                </span>
                {log.warehouse_id && (
                  <span className="truncate">
                    {labels.warehouseId}: {log.warehouse_id}
                  </span>
                )}
                <span className="truncate">
                  {labels.changedFields}: {presentation.changedText}
                </span>
              </span>
            </span>

            <span className="space-y-1 text-sm text-[var(--color-text-secondary)] lg:text-right">
              <span className="block">
                {labels.actionTime}: {formatAuditDate(log.action_time)}
              </span>
              <span className="block text-[var(--color-text-muted)]">
                {labels.syncTime}: {formatAuditDate(log.sync_time)}
              </span>
            </span>

            <ChevronRight
              size={18}
              className="hidden text-[var(--color-text-muted)] md:block"
            />
          </button>
        );
      })}
    </section>
  );
}
