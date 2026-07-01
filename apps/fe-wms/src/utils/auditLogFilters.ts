import type { AuditAction, AuditLog } from "@bduck/shared-types";

export type AuditSortField =
  | "sync_time"
  | "action_time"
  | "action"
  | "entity_type"
  | "warehouse_id"
  | "user_id";
export type AuditSortDirection = "asc" | "desc";
export type AuditValueState = "all" | "has_old" | "has_new" | "has_both";

export interface AuditLogFilters {
  search: string;
  entityType: string;
  entityId: string;
  warehouseId: string;
  userId: string;
  action: string;
  fromDate: string;
  toDate: string;
  valueState: AuditValueState;
  hasIp: boolean;
  hasDevice: boolean;
  hasSession: boolean;
  hasNotes: boolean;
  sortField: AuditSortField;
  sortDirection: AuditSortDirection;
}

export const defaultAuditLogFilters: AuditLogFilters = {
  search: "",
  entityType: "all",
  entityId: "",
  warehouseId: "",
  userId: "",
  action: "all",
  fromDate: "",
  toDate: "",
  valueState: "all",
  hasIp: false,
  hasDevice: false,
  hasSession: false,
  hasNotes: false,
  sortField: "sync_time",
  sortDirection: "desc",
};

export function getAuditDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  if (typeof value === "object" && value !== null) {
    const seconds =
      "_seconds" in value
        ? value._seconds
        : "seconds" in value
          ? value.seconds
          : null;

    if (typeof seconds === "number") {
      const nanoseconds =
        "_nanoseconds" in value && typeof value._nanoseconds === "number"
          ? value._nanoseconds
          : "nanoseconds" in value && typeof value.nanoseconds === "number"
            ? value.nanoseconds
            : 0;

      return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000));
    }
  }

  return null;
}

export function formatAuditDate(value: unknown, fallback = "-") {
  const date = getAuditDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getSortValue(log: AuditLog, field: AuditSortField): string | number {
  if (field === "sync_time" || field === "action_time") {
    return getAuditDate(log[field])?.getTime() || 0;
  }
  return String(log[field] || "").toLowerCase();
}

export function filterAuditLogs(
  logs: AuditLog[],
  filters: AuditLogFilters,
): AuditLog[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const fromTime = filters.fromDate
    ? new Date(`${filters.fromDate}T00:00:00`).getTime()
    : null;
  const toTime = filters.toDate
    ? new Date(`${filters.toDate}T23:59:59`).getTime()
    : null;

  return logs
    .filter((log) => {
      const actionTime = getAuditDate(log.action_time)?.getTime() || 0;
      const haystack = [
        log.id,
        log.entity_type,
        log.entity_id,
        log.warehouse_id,
        log.action,
        log.user_id,
        log.ip_address,
        log.device_id,
        log.notes,
        stringifyValue(log.old_value),
        stringifyValue(log.new_value),
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch))
        return false;
      if (
        filters.entityType !== "all" &&
        log.entity_type !== filters.entityType
      ) {
        return false;
      }
      if (filters.action !== "all" && log.action !== filters.action)
        return false;
      if (filters.entityId && !log.entity_id.includes(filters.entityId))
        return false;
      if (
        filters.warehouseId &&
        !(log.warehouse_id || "").includes(filters.warehouseId)
      ) {
        return false;
      }
      if (filters.userId && !log.user_id.includes(filters.userId)) return false;
      if (fromTime !== null && actionTime < fromTime) return false;
      if (toTime !== null && actionTime > toTime) return false;
      if (filters.valueState === "has_old" && !log.old_value) return false;
      if (filters.valueState === "has_new" && !log.new_value) return false;
      if (
        filters.valueState === "has_both" &&
        (!log.old_value || !log.new_value)
      ) {
        return false;
      }
      if (filters.hasIp && !log.ip_address) return false;
      if (filters.hasDevice && !log.device_id) return false;
      if (filters.hasSession && !log.session_token) return false;
      if (filters.hasNotes && !log.notes) return false;
      return true;
    })
    .sort((a, b) => {
      const left = getSortValue(a, filters.sortField);
      const right = getSortValue(b, filters.sortField);
      const modifier = filters.sortDirection === "asc" ? 1 : -1;
      return left > right ? modifier : left < right ? -modifier : 0;
    });
}

export function getUniqueEntityTypes(logs: AuditLog[]): string[] {
  return Array.from(new Set(logs.map((log) => log.entity_type))).sort();
}

export function getUniqueActions(logs: AuditLog[]): AuditAction[] {
  return Array.from(new Set(logs.map((log) => log.action))).sort();
}

export function countChangedKeys(log: AuditLog): number {
  return getChangedKeys(log).length;
}

function stringifyComparableValue(value: unknown): string {
  if (value === undefined) return "__undefined__";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getChangedKeys(log: AuditLog): string[] {
  const oldValue = log.old_value || {};
  const newValue = log.new_value || {};
  const keys =
    log.action === "UPDATE" && log.new_value
      ? Object.keys(newValue)
      : Array.from(
          new Set([...Object.keys(oldValue), ...Object.keys(newValue)]),
        );

  return keys.filter(
    (key) =>
      stringifyComparableValue(oldValue[key]) !==
      stringifyComparableValue(newValue[key]),
  );
}
