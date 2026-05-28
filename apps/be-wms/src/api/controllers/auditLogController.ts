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
