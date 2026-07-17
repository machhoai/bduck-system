import type { Request, Response } from "express";
import { z } from "zod";
import { fetchAuditLogs } from "../../services/auditLogService.js";
import { authorizationError } from "../../services/authorization/index.js";
import { auditLogQuerySchema } from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const exportActionSchema = z.object({
  entity_type: z.string().trim().min(1).max(120),
  filters: z.record(z.string(), z.unknown()).optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
});

const handleAuditLogError = (res: Response, error: unknown) => {
  console.error("[auditLogController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Bộ lọc audit log không hợp lệ.",
        zh: "审计日志筛选条件无效。",
      },
      400,
      error.flatten(),
    );
  }

  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi khi tải audit log.",
      zh: "加载审计日志时出错。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getAuditLogsHandler = async (req: Request, res: Response) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const logs = await fetchAuditLogs(query, requireRequestAuthorization(req));

    return sendSuccess(res, logs, {
      vi: "Lấy audit log thành công.",
      zh: "成功获取审计日志。",
    });
  } catch (error) {
    return handleAuditLogError(res, error);
  }
};

export const logExportActionHandler = async (req: Request, res: Response) => {
  try {
    const user = requireAuthenticatedRequestUser(req);
    const authorization = requireRequestAuthorization(req);
    const { entity_type, filters, warehouse_id } = exportActionSchema.parse(
      req.body ?? {},
    );
    if (warehouse_id) authorization.assert("audit.read", warehouse_id);
    else if (!authorization.context.isSystemAdmin) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }

    const { logAudit } = await import("../../services/auditService.js");
    const { AuditAction } = await import("@bduck/shared-types");

    await logAudit({
      entity_type,
      entity_id: "EXPORT",
      warehouse_id: warehouse_id ?? null,
      action: AuditAction.EXPORT,
      user_id: user.id,
      user_name: user.full_name || user.username || user.email || null,
      entity_name: entity_type,
      old_value: filters ? { filters } : null,
      new_value: null,
      notes: "Tải file Excel",
      ip_address: req.ip,
      device_id: (req.headers["x-device-id"] as string) || null,
      session_token: req.cookies?.__session || null,
    });

    return sendSuccess(
      res,
      { success: true },
      {
        vi: "Ghi log xuất dữ liệu thành công.",
        zh: "成功记录导出数据日志。",
      },
    );
  } catch (error) {
    return handleAuditLogError(res, error);
  }
};
