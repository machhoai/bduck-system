"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { AuditLogDetailPanel } from "@/components/audit-logs/AuditLogDetailPanel";
import { AuditLogFiltersPanel } from "@/components/audit-logs/AuditLogFiltersPanel";
import { AuditLogList } from "@/components/audit-logs/AuditLogList";
import { AuditLogSkeleton } from "@/components/audit-logs/AuditLogSkeleton";
import { AuditLogStats } from "@/components/audit-logs/AuditLogStats";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useAuditNameResolver } from "@/hooks/useAuditNameResolver";
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { useTranslation } from "@/lib/i18n";
import {
    defaultAuditLogFilters,
    filterAuditLogs,
    getUniqueActions,
    getUniqueEntityTypes,
} from "@/utils/auditLogFilters";
import { formatExportDate } from "@/utils/exportExcel";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500];

export function AuditLogManagementPanel() {
    const { t } = useTranslation();
    const { logs, isLoading, error } = useAuditLogs();
    const [filters, setFilters] = useState(defaultAuditLogFilters);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const entityTypes = useMemo(() => getUniqueEntityTypes(logs), [logs]);
    const actions = useMemo(() => getUniqueActions(logs), [logs]);
    const filteredLogs = useMemo(
        () => filterAuditLogs(logs, filters),
        [logs, filters],
    );
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [currentPage, filteredLogs, pageSize]);
    const pageNumbers = useMemo(() => {
        const pages = new Set([
            1,
            totalPages,
            currentPage - 1,
            currentPage,
            currentPage + 1,
        ]);
        return Array.from(pages)
            .filter((page) => page >= 1 && page <= totalPages)
            .sort((a, b) => a - b);
    }, [currentPage, totalPages]);
    const visibleStart =
        filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const visibleEnd = Math.min(currentPage * pageSize, filteredLogs.length);
    const activeLog = selectedLog
        ? paginatedLogs.find((log) => log.id === selectedLog.id) ||
          paginatedLogs[0] ||
          null
        : paginatedLogs[0] || null;

    // Resolve raw IDs → human-readable names for all visible logs
    const { resolveUser, resolveWarehouse, resolveEntity } =
        useAuditNameResolver(filteredLogs);
    const resolver = useMemo(
        () => ({ resolveUser, resolveWarehouse, resolveEntity }),
        [resolveUser, resolveWarehouse, resolveEntity],
    );

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleFiltersChange = (nextFilters: typeof defaultAuditLogFilters) => {
        setFilters(nextFilters);
        setCurrentPage(1);
        setSelectedLog(null);
    };

    const handlePageSizeChange = (nextPageSize: number) => {
        setPageSize(nextPageSize);
        setCurrentPage(1);
        setSelectedLog(null);
    };

    const exportConfig = useMemo(() => {
        if (!filteredLogs.length) return null;
        return {
            filename: "audit_logs",
            entityType: "audit_logs",
            filters,
            data: filteredLogs,
            columns: [
                { header: "ID", key: "id", width: 35 },
                { header: "Entity Type", key: "entity_type", width: 25 },
                { header: "Entity ID", key: "entity_id", width: 35 },
                { header: "Warehouse ID", key: "warehouse_id", width: 35, format: (val: string) => resolveWarehouse(val) || val },
                { header: "Action", key: "action", width: 15 },
                { header: "User ID", key: "user_id", width: 35, format: (val: string) => resolveUser(val) || val },
                { header: "User Name", key: "user_name", width: 25 },
                { header: "Entity Name", key: "entity_name", width: 25 },
                { header: "Action Time", key: "action_time", width: 25, format: formatExportDate },
                { header: "Sync Time", key: "sync_time", width: 25, format: formatExportDate },
                { header: "Old Value", key: "old_value", width: 50, format: (val: any) => val ? JSON.stringify(val) : "" },
                { header: "New Value", key: "new_value", width: 50, format: (val: any) => val ? JSON.stringify(val) : "" },
                { header: "IP Address", key: "ip_address", width: 20 },
                { header: "Device ID", key: "device_id", width: 20 },
                { header: "Session Token", key: "session_token", width: 35 },
                { header: "Notes", key: "notes", width: 30 },
            ],
        };
    }, [filteredLogs, filters, resolveUser, resolveWarehouse]);

    useExportRegistration(exportConfig);

    return (
        <div className="flex flex-col gap-4">
            <header>
                <h1 className="font-[var(--font-display)] text-lg font-semibold leading-[1.1] tracking-normal text-[var(--color-text-primary)] lg:text-lg">
                    {t.auditLog.title}
                </h1>
                <p className="text-sm leading-[1.47] text-[var(--color-text-secondary)]">
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
                onChange={handleFiltersChange}
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
                    <div className="flex min-w-0 flex-col gap-3">
                        <AuditLogList
                            logs={paginatedLogs}
                            selectedId={activeLog?.id}
                            resolver={resolver}
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
                        {filteredLogs.length > 0 && (
                            <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-4 py-3 text-sm text-[var(--color-text-secondary)] md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span>
                                        {t.auditLog.showing} {visibleStart}-{visibleEnd} /{" "}
                                        {filteredLogs.length}
                                    </span>
                                    <label className="flex items-center gap-2">
                                        <span>{t.auditLog.rowsPerPage}</span>
                                        <select
                                            value={pageSize}
                                            onChange={(event) =>
                                                handlePageSizeChange(Number(event.target.value))
                                            }
                                            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-primary)]"
                                        >
                                            {PAGE_SIZE_OPTIONS.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCurrentPage((page) => Math.max(1, page - 1))
                                        }
                                        disabled={currentPage === 1}
                                        aria-label={t.auditLog.previousPage}
                                        title={t.auditLog.previousPage}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-card)] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    {pageNumbers.map((page, index) => {
                                        const previousPage = pageNumbers[index - 1];
                                        const showGap =
                                            previousPage !== undefined && page - previousPage > 1;
                                        return (
                                            <span key={page} className="flex items-center gap-2">
                                                {showGap && (
                                                    <span className="px-1 text-[var(--color-text-muted)]">
                                                        ...
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] border px-3 text-sm font-semibold transition ${
                                                        currentPage === page
                                                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                                                            : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.min(totalPages, page + 1),
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                        aria-label={t.auditLog.nextPage}
                                        title={t.auditLog.nextPage}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-card)] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                    <span className="ml-1 whitespace-nowrap">
                                        {t.auditLog.page} {currentPage} {t.auditLog.of}{" "}
                                        {totalPages}
                                    </span>
                                </div>
                            </section>
                        )}
                    </div>
                    <AuditLogDetailPanel
                        log={activeLog}
                        resolver={resolver}
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
