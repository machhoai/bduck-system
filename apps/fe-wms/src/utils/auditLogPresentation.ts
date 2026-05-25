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
}

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
): AuditLogPresentation {
  const action = labels.actionLabels[log.action] || log.action;
  const entity =
    labels.entityLabels[log.entity_type] || formatToken(log.entity_type);
  const page = labels.pageLabels[log.entity_type] || labels.unknownPage;
  const actor = log.user_name || log.user_id || labels.unknownUser;
  const record = getRecordLabel(log);
  const changedFields = getChangedKeys(log);
  const changedText =
    changedFields.length > 0
      ? `${changedFields.length} ${labels.changedFields}`
      : labels.noChangedFields;
  const target = record
    ? `${entity} "${record}"`
    : `${entity} ${log.entity_id}`;
  const summary = log.notes?.trim() || `${action} ${target} - ${changedText}`;

  return {
    action,
    actor,
    entity,
    page,
    record: record || `${labels.record} ${log.entity_id}`,
    summary,
    changedText,
    changedFields,
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
