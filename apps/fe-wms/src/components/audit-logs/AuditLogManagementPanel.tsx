"use client";

import { useMemo, useState } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { AuditLogDetailPanel } from "@/components/audit-logs/AuditLogDetailPanel";
import { AuditLogFiltersPanel } from "@/components/audit-logs/AuditLogFiltersPanel";
import { AuditLogList } from "@/components/audit-logs/AuditLogList";
import { AuditLogSkeleton } from "@/components/audit-logs/AuditLogSkeleton";
import { AuditLogStats } from "@/components/audit-logs/AuditLogStats";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useTranslation } from "@/lib/i18n";
import {
  defaultAuditLogFilters,
  filterAuditLogs,
  getUniqueActions,
  getUniqueEntityTypes,
} from "@/utils/auditLogFilters";

export function AuditLogManagementPanel() {
  const { t } = useTranslation();
  const { logs, isLoading, error } = useAuditLogs();
  const [filters, setFilters] = useState(defaultAuditLogFilters);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const entityTypes = useMemo(() => getUniqueEntityTypes(logs), [logs]);
  const actions = useMemo(() => getUniqueActions(logs), [logs]);
  const filteredLogs = useMemo(
    () => filterAuditLogs(logs, filters),
    [logs, filters],
  );
  const activeLog = selectedLog
    ? filteredLogs.find((log) => log.id === selectedLog.id) || selectedLog
    : filteredLogs[0] || null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)] lg:text-[40px]">
          {t.auditLog.title}
        </h1>
        <p className="text-[17px] leading-[1.47] text-[var(--color-text-secondary)]">
          {t.auditLog.description}
        </p>
      </header>

      <AuditLogStats
        total={logs.length}
        visible={filteredLogs.length}
        logs={filteredLogs}
        labels={{
          total: t.auditLog.totalLogs,
          visible: t.auditLog.visibleLogs,
          entities: t.auditLog.entities,
          users: t.auditLog.users,
        }}
      />

      <AuditLogFiltersPanel
        filters={filters}
        entityTypes={entityTypes}
        actions={actions}
        onChange={setFilters}
        labels={{
          search: t.auditLog.search,
          entityType: t.auditLog.entityType,
          entityId: t.auditLog.entityId,
          warehouseId: t.auditLog.warehouseId,
          userId: t.auditLog.userId,
          action: t.auditLog.action,
          fromDate: t.auditLog.fromDate,
          toDate: t.auditLog.toDate,
          valueState: t.auditLog.valueState,
          sortBy: t.auditLog.sortBy,
          sortDirection: t.auditLog.sortDirection,
          clear: t.products.clearFilters,
          all: t.auditLog.all,
          hasOld: t.auditLog.hasOld,
          hasNew: t.auditLog.hasNew,
          hasBoth: t.auditLog.hasBoth,
          hasIp: t.auditLog.hasIp,
          hasDevice: t.auditLog.hasDevice,
          hasSession: t.auditLog.hasSession,
          hasNotes: t.auditLog.hasNotes,
          asc: t.auditLog.asc,
          desc: t.auditLog.desc,
        }}
      />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent-error)] bg-white p-4 text-[var(--color-accent-error)]">
          {error}
        </div>
      )}

      {isLoading ? (
        <AuditLogSkeleton />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <AuditLogList
            logs={filteredLogs}
            selectedId={activeLog?.id}
            onSelect={setSelectedLog}
            labels={{
              empty: t.auditLog.empty,
              emptyHint: t.auditLog.emptyHint,
              changedFields: t.auditLog.changedFields,
              actionTime: t.auditLog.actionTime,
              syncTime: t.auditLog.syncTime,
              operation: t.auditLog.operation,
              performedBy: t.auditLog.performedBy,
              warehouseId: t.auditLog.warehouseId,
              summary: t.auditLog.summary,
              page: t.auditLog.page,
              record: t.auditLog.record,
              unknownPage: t.auditLog.unknownPage,
              unknownUser: t.auditLog.unknownUser,
              noChangedFields: t.auditLog.noChangedFields,
              actionLabels: t.auditLog.actionLabels,
              entityLabels: t.auditLog.entityLabels,
              pageLabels: t.auditLog.pageLabels,
            }}
          />
          <AuditLogDetailPanel
            log={activeLog}
            labels={{
              detail: t.auditLog.detail,
              selectHint: t.auditLog.selectHint,
              actionTime: t.auditLog.actionTime,
              syncTime: t.auditLog.syncTime,
              userId: t.auditLog.userId,
              warehouseId: t.auditLog.warehouseId,
              ipAddress: t.auditLog.ipAddress,
              deviceId: t.auditLog.deviceId,
              sessionToken: t.auditLog.sessionToken,
              notes: t.auditLog.notes,
              oldValue: t.auditLog.oldValue,
              newValue: t.auditLog.newValue,
              noData: t.common.noData,
              operation: t.auditLog.operation,
              performedBy: t.auditLog.performedBy,
              summary: t.auditLog.summary,
              page: t.auditLog.page,
              entity: t.auditLog.entityType,
              record: t.auditLog.record,
              changedFields: t.auditLog.changedFields,
              unknownPage: t.auditLog.unknownPage,
              unknownUser: t.auditLog.unknownUser,
              noChangedFields: t.auditLog.noChangedFields,
              actionLabels: t.auditLog.actionLabels,
              entityLabels: t.auditLog.entityLabels,
              pageLabels: t.auditLog.pageLabels,
            }}
          />
        </div>
      )}
    </div>
  );
}
