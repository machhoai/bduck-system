import {
  ClipboardList,
  MapPinned,
  MonitorSmartphone,
  Network,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { formatAuditDate } from "@/utils/auditLogFilters";
import {
  formatFieldName,
  getAuditLogPresentation,
  type AuditLogPresentationLabels,
} from "@/utils/auditLogPresentation";

interface AuditLogDetailPanelProps {
  log: AuditLog | null;
  labels: {
    detail: string;
    selectHint: string;
    actionTime: string;
    syncTime: string;
    userId: string;
    ipAddress: string;
    deviceId: string;
    sessionToken: string;
    notes: string;
    oldValue: string;
    newValue: string;
    noData: string;
    operation: string;
    performedBy: string;
    summary: string;
    page: string;
    entity: string;
    record: string;
    changedFields: string;
    unknownPage: string;
    unknownUser: string;
    noChangedFields: string;
    actionLabels: Record<string, string>;
    entityLabels: Record<string, string>;
    pageLabels: Record<string, string>;
  };
}

export function AuditLogDetailPanel({ log, labels }: AuditLogDetailPanelProps) {
  return (
    <aside className="sticky top-4 space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
      <h2 className="text-[21px] font-semibold text-[var(--color-text-primary)]">
        {labels.detail}
      </h2>

      {!log ? (
        <p className="text-[17px] text-[var(--color-text-muted)]">
          {labels.selectHint}
        </p>
      ) : (
        (() => {
          const presentation = getAuditLogPresentation(
            log,
            labels as AuditLogPresentationLabels,
          );

          return (
            <>
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                <p className="text-xs uppercase text-[var(--color-text-muted)]">
                  {labels.summary}
                </p>
                <p className="mt-1 text-[17px] font-semibold leading-snug text-[var(--color-text-primary)]">
                  {presentation.summary}
                </p>
              </div>

              <div className="grid gap-2 text-sm">
                <DetailLine
                  icon={<ClipboardList size={15} />}
                  label={labels.operation}
                  value={presentation.action}
                />
                <DetailLine
                  icon={<UserRound size={15} />}
                  label={labels.performedBy}
                  value={presentation.actor}
                />
                <DetailLine
                  icon={<MapPinned size={15} />}
                  label={labels.page}
                  value={presentation.page}
                />
                <DetailLine label={labels.entity} value={presentation.entity} />
                <DetailLine label={labels.record} value={presentation.record} />
                <DetailLine
                  label={labels.changedFields}
                  value={
                    presentation.changedFields.length > 0
                      ? presentation.changedFields
                          .map(formatFieldName)
                          .join(", ")
                      : labels.noChangedFields
                  }
                />
                <DetailLine
                  label={labels.actionTime}
                  value={formatAuditDate(log.action_time)}
                />
                <DetailLine
                  label={labels.syncTime}
                  value={formatAuditDate(log.sync_time)}
                />
                <DetailLine
                  icon={<UserRound size={15} />}
                  label={labels.userId}
                  value={log.user_id}
                />
                <DetailLine
                  icon={<Network size={15} />}
                  label={labels.ipAddress}
                  value={log.ip_address || labels.noData}
                />
                <DetailLine
                  icon={<MonitorSmartphone size={15} />}
                  label={labels.deviceId}
                  value={log.device_id || labels.noData}
                />
                <DetailLine
                  label={labels.sessionToken}
                  value={log.session_token || labels.noData}
                />
                <DetailLine
                  label={labels.notes}
                  value={log.notes || labels.noData}
                />
              </div>

              <JsonBlock
                label={labels.oldValue}
                value={log.old_value}
                empty={labels.noData}
              />
              <JsonBlock
                label={labels.newValue}
                value={log.new_value}
                empty={labels.noData}
              />
            </>
          );
        })()
      )}
    </aside>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] p-2">
      {icon && (
        <span className="mt-0.5 text-[var(--color-text-muted)]">{icon}</span>
      )}
      <span className="min-w-0">
        <span className="block text-xs text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="block break-all text-[var(--color-text-primary)]">
          {value}
        </span>
      </span>
    </div>
  );
}

function JsonBlock({
  label,
  value,
  empty,
}: {
  label: string;
  value: Record<string, unknown> | null;
  empty: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
      </p>
      <pre className="max-h-60 overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {value ? JSON.stringify(value, null, 2) : empty}
      </pre>
    </div>
  );
}
