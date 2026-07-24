import type { Request, Response } from "express";
import { z } from "zod";
import { fetchMyLeaveBalance } from "../../services/leaveBalanceService.js";
import { runDailyLeaveMaintenance } from "../../services/leaveMaintenanceService.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  hasNonEmptySecret,
  securelyMatchesSecret,
} from "../../utils/secureSecret.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const maintenanceSchema = z
  .object({
    posting_date: z.string().date().optional(),
  })
  .strict();

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveBalanceController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu xử lý ngày phép không hợp lệ.",
        zh: "假期处理数据无效。",
      },
      400,
      error.flatten(),
    );
  }
  const firebaseMapped = mapFirebaseError(error);
  if (firebaseMapped) {
    return sendError(res, firebaseMapped.messages, firebaseMapped.statusCode);
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý số dư ngày phép.",
      zh: "无法处理假期余额。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getMyLeaveBalanceHandler = async (req: Request, res: Response) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const data = await fetchMyLeaveBalance(
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải số dư ngày phép.",
      zh: "假期余额已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const runLeaveMaintenanceHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const configuredSecret = process.env.LEAVE_MAINTENANCE_CRON_SECRET;
    if (!hasNonEmptySecret(configuredSecret)) {
      return sendError(
        res,
        {
          vi: "Chưa cấu hình khóa bảo mật cho lịch xử lý ngày phép.",
          zh: "尚未配置假期定时任务密钥。",
        },
        503,
      );
    }
    if (!securelyMatchesSecret(req.header("x-cron-secret"), configuredSecret)) {
      return sendError(
        res,
        {
          vi: "Khóa bảo mật lịch xử lý ngày phép không hợp lệ.",
          zh: "假期定时任务密钥无效。",
        },
        401,
      );
    }
    const input = maintenanceSchema.parse(req.body ?? {});
    const data = await runDailyLeaveMaintenance(input.posting_date);
    return sendSuccess(res, data, {
      vi: "Đã hoàn tất xử lý ngày phép định kỳ.",
      zh: "定期假期处理已完成。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
