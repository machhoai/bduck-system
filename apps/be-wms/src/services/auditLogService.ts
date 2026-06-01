import type { AuditLog } from "@bduck/shared-types";
import type { z } from "zod";
import {
  auditLogRepository,
  type AuditLogSearchParams,
} from "../repositories/auditLogRepository.js";
import { auditLogQuerySchema } from "../utils/zodSchemas.js";

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

/**
 * User permissions shape injected by authMiddleware.
 * Keys are "global" or warehouse UUIDs, values are permission maps.
 */
type UserPermissions = Record<string, Record<string, unknown>>;

/**
 * Extract the warehouse IDs that a user has `audit.read` permission for.
 * Returns `undefined` if the user has global access (no restriction needed).
 */
function extractAllowedWarehouseIds(
  permissions: UserPermissions,
): string[] | undefined {
  const globalPerms = permissions["global"] || {};

  // Global admin or global audit.read → unrestricted
  if (globalPerms["*"] === true || globalPerms["audit.read"] === true) {
    return undefined;
  }

  // Collect warehouse-scoped audit.read permissions
  const warehouseIds: string[] = [];
  for (const [scope, scopePerms] of Object.entries(permissions)) {
    if (scope === "global") continue;
    if (scopePerms["*"] === true || scopePerms["audit.read"] === true) {
      warehouseIds.push(scope);
    }
  }

  return warehouseIds;
}

export const fetchAuditLogs = async (
  input: AuditLogQueryInput,
  userPermissions?: UserPermissions,
): Promise<AuditLog[]> => {
  const allowedWarehouseIds = userPermissions
    ? extractAllowedWarehouseIds(userPermissions)
    : undefined;

  if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
    return [];
  }

  if (
    input.warehouse_id &&
    allowedWarehouseIds &&
    !allowedWarehouseIds.includes(input.warehouse_id)
  ) {
    return [];
  }

  const params: AuditLogSearchParams = {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    warehouse_id: input.warehouse_id,
    action: input.action,
    user_id: input.user_id,
    from: input.from,
    to: input.to,
    limit: input.limit,
    sort_by: input.sort_by,
    sort_dir: input.sort_dir,
    allowed_warehouse_ids:
      input.warehouse_id && allowedWarehouseIds
        ? [input.warehouse_id]
        : allowedWarehouseIds,
  };

  return auditLogRepository.findAuditLogs(params);
};
