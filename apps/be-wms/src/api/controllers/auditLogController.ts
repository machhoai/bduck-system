import type { Request, Response } from "express";
import { z } from "zod";
import { fetchAuditLogs } from "../../services/auditLogService.js";
import { auditLogQuerySchema } from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

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

  return sendError(
    res,
    {
      vi: "Lỗi khi tải audit log.",
      zh: "加载审计日志时出错。",
    },
    500,
  );
};

export const getAuditLogsHandler = async (req: Request, res: Response) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const user = (req as any).user;
    const userPermissions = user?.permissions || {};

    const logs = await fetchAuditLogs(query, userPermissions);

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
    const user = (req as any).user;
    const { entity_type, filters, warehouse_id } = req.body;

    if (!entity_type) {
      return sendError(
        res,
        {
          vi: "Thiếu thông tin entity_type.",
          zh: "缺少 entity_type 信息。",
        },
        400,
      );
    }

    const { logAudit } = await import("../../services/auditService.js");
    const { AuditAction } = await import("@bduck/shared-types");

    await logAudit({
      entity_type,
      entity_id: "EXPORT",
      warehouse_id: warehouse_id || null,
      action: AuditAction.EXPORT,
      user_id: user?.id || "system",
      user_name: user?.full_name || user?.username || user?.email || null,
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
    console.error("[logExportActionHandler] error:", error);
    return sendError(
      res,
      {
        vi: "Lỗi khi ghi log xuất dữ liệu.",
        zh: "记录导出数据日志时出错。",
      },
      500,
    );
  }
};
