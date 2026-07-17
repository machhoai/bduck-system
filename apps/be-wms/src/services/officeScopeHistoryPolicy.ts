import {
  AuditAction,
  type AuditLog,
  type OfficeScopeHistoryEntry,
  type OfficeScopeMode,
} from "@bduck/shared-types";
import type { AuthorizationService } from "./authorization/index.js";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const asMode = (value: unknown): OfficeScopeMode | null =>
  value === "ALL" || value === "SELECTED" ? value : null;

const asIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          ),
        ),
      ).sort()
    : [];

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const timestamp = asRecord(value);
  if (timestamp && typeof timestamp.toDate === "function") {
    const parsed = (timestamp.toDate as () => Date)();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed
      : null;
  }
  const seconds = timestamp?.seconds ?? timestamp?._seconds;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
};

const difference = (left: string[], right: string[]) => {
  const excluded = new Set(right);
  return left.filter((id) => !excluded.has(id));
};

export const assertCanReadOfficeScopeHistory = (
  authorization: AuthorizationService,
  officeId: string,
): void => authorization.assert("office_scopes.read", officeId);

export const buildOfficeScopeHistory = (
  logs: AuditLog[],
  officeId: string,
): OfficeScopeHistoryEntry[] =>
  logs.flatMap((log) => {
    if (
      log.entity_type !== "office_scope_configs" ||
      log.entity_id !== officeId ||
      (log.action !== AuditAction.CREATE && log.action !== AuditAction.UPDATE)
    ) {
      return [];
    }
    const oldValue = asRecord(log.old_value);
    const newValue = asRecord(log.new_value);
    const oldConfig = asRecord(oldValue?.config);
    const newConfig = asRecord(newValue?.config);
    const nextMode = asMode(newConfig?.scope_mode);
    const revision = newConfig?.revision;
    const actionTime = asDate(log.action_time);
    const syncTime = asDate(log.sync_time);
    if (
      !nextMode ||
      !Number.isInteger(revision) ||
      (revision as number) < 1 ||
      !actionTime ||
      !syncTime
    ) {
      return [];
    }
    const previousIds = asIds(oldValue?.target_facility_ids);
    const nextIds = asIds(newValue?.target_facility_ids);
    const affectedCount = newValue?.affected_employee_count;
    return [
      {
        id: log.id,
        office_id: officeId,
        revision: revision as number,
        action: log.action,
        actor_id: log.user_id,
        actor_name: log.user_name ?? null,
        action_time: actionTime,
        sync_time: syncTime,
        previous_mode: asMode(oldConfig?.scope_mode),
        next_mode: nextMode,
        previous_selected_facility_ids: previousIds,
        next_selected_facility_ids: nextIds,
        added_facility_ids: difference(nextIds, previousIds),
        removed_facility_ids: difference(previousIds, nextIds),
        affected_employee_count:
          Number.isInteger(affectedCount) && (affectedCount as number) >= 0
            ? (affectedCount as number)
            : null,
        materialization: null,
      },
    ];
  });
