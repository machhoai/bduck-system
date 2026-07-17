import type { AuditLog } from "@bduck/shared-types";
import type { z } from "zod";
import {
  auditLogRepository,
  type AuditLogSearchParams,
} from "../repositories/auditLogRepository.js";
import { auditLogQuerySchema } from "../utils/zodSchemas.js";
import {
  authorizationError,
  type AuthorizationService,
} from "./authorization/index.js";

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

export const fetchAuditLogs = async (
  input: AuditLogQueryInput,
  authorization: AuthorizationService,
): Promise<AuditLog[]> => {
  const allowedWarehouseIds = authorization.context.isSystemAdmin
    ? undefined
    : authorization.facilityIdsFor("audit.read");

  if (input.warehouse_id) {
    authorization.assert("audit.read", input.warehouse_id);
  } else if (allowedWarehouseIds?.length === 0) {
    throw authorizationError("AUTHORIZATION_DENIED");
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
    offset: input.offset ?? (input.page - 1) * input.limit,
    sort_by: input.sort_by,
    sort_dir: input.sort_dir,
    allowed_warehouse_ids:
      input.warehouse_id && allowedWarehouseIds
        ? [input.warehouse_id]
        : allowedWarehouseIds,
  };

  return auditLogRepository.findAuditLogs(params);
};
