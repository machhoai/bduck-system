import type { AuditLog } from "@bduck/shared-types";
import type { z } from "zod";
import {
  auditLogRepository,
  type AuditLogSearchParams,
} from "../repositories/auditLogRepository.js";
import { auditLogQuerySchema } from "../utils/zodSchemas.js";

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

export const fetchAuditLogs = async (
  input: AuditLogQueryInput,
): Promise<AuditLog[]> => {
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
  };

  return auditLogRepository.findAuditLogs(params);
};
