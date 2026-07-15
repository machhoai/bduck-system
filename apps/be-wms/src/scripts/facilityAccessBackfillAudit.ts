import { createHash } from "node:crypto";
import { type AuditAction } from "@bduck/shared-types";
import type { DocumentData } from "./facilityAccessBackfillPlanner.js";

export const deterministicAuditId = (
  migrationId: string,
  entityType: string,
  entityId: string,
): string =>
  `facility-access-${createHash("sha256")
    .update(`${migrationId}:${entityType}:${entityId}`)
    .digest("hex")
    .slice(0, 40)}`;

export const buildMigrationAudit = ({
  id,
  entityType,
  entityId,
  warehouseId,
  action,
  initiatedBy,
  oldValue,
  newValue,
  now,
  migrationId,
}: {
  id: string;
  entityType: string;
  entityId: string;
  warehouseId: string | null;
  action: AuditAction;
  initiatedBy: string;
  oldValue: DocumentData | null;
  newValue: DocumentData;
  now: Date;
  migrationId: string;
}): DocumentData => ({
  id,
  entity_type: entityType,
  entity_id: entityId,
  warehouse_id: warehouseId,
  action,
  user_id: initiatedBy,
  user_name: "Facility access migration",
  entity_name: entityId,
  action_time: now,
  sync_time: now,
  old_value: oldValue,
  new_value: newValue,
  ip_address: null,
  device_id: null,
  session_token: null,
  notes: `Idempotent migration ${migrationId}`,
});
