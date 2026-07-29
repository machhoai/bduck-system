import type { Request, Response } from "express";
import { z } from "zod";
import {
  listExpiringEmployeeContracts,
  runEmployeeContractDailyAutomation,
} from "../../services/employeeContractAutomationService.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  hasNonEmptySecret,
  securelyMatchesSecret,
} from "../../utils/secureSecret.js";
import { requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

const expiringQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const handleError = (res: Response, error: unknown) => {
  console.error("[employeeContractAutomationController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Tham số truy vấn hợp đồng sắp hết hạn không hợp lệ.",
        zh: "即将到期合同的查询参数无效。",
      },
      400,
      error.flatten(),
    );
  }
  const firebaseMapped = mapFirebaseError(error);
  if (firebaseMapped) {
    return sendError(res, firebaseMapped.messages, firebaseMapped.statusCode);
  }
  return sendError(
    res,
    {
      vi: "Không thể xử lý cảnh báo và trạng thái hợp đồng.",
      zh: "无法处理合同提醒和状态。",
    },
    500,
  );
};

export const runEmployeeContractDailyAutomationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const configuredSecret = process.env.EMPLOYEE_CONTRACT_CRON_SECRET;
    if (!hasNonEmptySecret(configuredSecret)) {
      return sendError(
        res,
        {
          vi: "Chưa cấu hình khóa bảo mật cho lịch hợp đồng lao động.",
          zh: "尚未配置劳动合同定时任务密钥。",
        },
        503,
      );
    }
    if (!securelyMatchesSecret(req.header("x-cron-secret"), configuredSecret)) {
      return sendError(
        res,
        {
          vi: "Khóa bảo mật lịch hợp đồng không hợp lệ.",
          zh: "劳动合同定时任务密钥无效。",
        },
        401,
      );
    }
    const data = await runEmployeeContractDailyAutomation();
    return sendSuccess(res, data, {
      vi: data.in_progress
        ? "Lịch hợp đồng của ngày này đang được xử lý."
        : "Đã đồng bộ trạng thái và cảnh báo hợp đồng lao động.",
      zh: data.in_progress
        ? "当天的合同定时任务正在处理中。"
        : "劳动合同状态和到期提醒已同步。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listExpiringEmployeeContractsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { limit } = expiringQuerySchema.parse(req.query);
    const data = await listExpiringEmployeeContracts(
      requireRequestAuthorization(req),
      limit,
    );
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách hợp đồng sắp hết hạn.",
      zh: "即将到期的合同列表已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
