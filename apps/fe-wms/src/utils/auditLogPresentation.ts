import type { AuditLog } from "@bduck/shared-types";
import { getChangedKeys } from "@/utils/auditLogFilters";

export interface AuditLogPresentationLabels {
    actionLabels: Record<string, string>;
    entityLabels: Record<string, string>;
    pageLabels: Record<string, string>;
    record: string;
    unknownPage: string;
    unknownUser: string;
    changedFields: string;
    noChangedFields: string;
}

export interface AuditLogPresentation {
    action: string;
    actor: string;
    entity: string;
    page: string;
    record: string;
    summary: string;
    changedText: string;
    changedFields: string[];
    warehouseName: string | null;
}

/**
 * Name resolver functions injected by the parent component
 * to translate raw IDs into human-readable names.
 */
export interface AuditNameResolver {
    resolveUser: (userId: string) => string;
    resolveWarehouse: (warehouseId: string) => string;
    resolveEntity: (entityType: string, entityId: string) => string;
}

/** Fallback resolver that returns raw IDs (used when no resolver is provided) */
const IDENTITY_RESOLVER: AuditNameResolver = {
    resolveUser: (id) => id,
    resolveWarehouse: (id) => id,
    resolveEntity: (_type, id) => id,
};

const recordLabelFields = [
    "name",
    "code",
    "sku",
    "barcode",
    "email",
    "title",
    "description",
];

export function getAuditLogPresentation(
    log: AuditLog,
    labels: AuditLogPresentationLabels,
    resolver?: AuditNameResolver,
): AuditLogPresentation {
    const r = resolver || IDENTITY_RESOLVER;

    const action = labels.actionLabels[log.action] || log.action;
    const entity =
        labels.entityLabels[log.entity_type] || formatToken(log.entity_type);
    const page = labels.pageLabels[log.entity_type] || labels.unknownPage;

    // Resolve user name: prefer backend-enriched name, then resolver, then raw ID
    const actor =
        log.user_name || r.resolveUser(log.user_id) || labels.unknownUser;

    // Resolve record label: prefer snapshot fields, then backend entity_name, then resolver
    const snapshotLabel = getRecordLabel(log);
    const resolvedEntityName =
        log.entity_name || r.resolveEntity(log.entity_type, log.entity_id);
    const record = snapshotLabel !== log.entity_id
        ? snapshotLabel
        : resolvedEntityName || log.entity_id;

    // Resolve warehouse name
    const warehouseName = log.warehouse_id
        ? r.resolveWarehouse(log.warehouse_id)
        : null;

    const changedFields = getChangedKeys(log);
    const changedText =
        changedFields.length > 0
            ? `${changedFields.length} ${labels.changedFields}`
            : labels.noChangedFields;

    const target = record !== log.entity_id
        ? `${entity} "${record}"`
        : `${entity} / ${record}`;
    const summary = log.notes?.trim() || `${action} ${target} - ${changedText}`;

    return {
        action,
        actor,
        entity,
        page,
        record,
        summary,
        changedText,
        changedFields,
        warehouseName,
    };
}

export function formatFieldName(field: string) {
    return formatToken(field);
}

function getRecordLabel(log: AuditLog) {
    for (const field of recordLabelFields) {
        const value =
            getSnapshotField(log.new_value, field) ??
            getSnapshotField(log.old_value, field);
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number") return String(value);
    }

    return log.entity_id;
}

function getSnapshotField(
    snapshot: Record<string, unknown> | null,
    field: string,
) {
    if (!snapshot || !(field in snapshot)) return undefined;
    return snapshot[field];
}

function formatToken(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
