import type { Request, Response } from "express";
import { z } from "zod";
import {
  applyDueEmployeeEmploymentTransitions,
  cancelEmployeeEmploymentTransition,
  createEmployeeEmploymentTransition,
  fetchEmployeeEmploymentTransitions,
} from "../../services/employeeEmploymentService.js";
import {
  cancelEmployeeEmploymentTransitionSchema,
  createEmployeeEmploymentTransitionSchema,
} from "../../services/employeeEmploymentSchemas.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
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

const profileIdSchema = z.object({ id: z.string().uuid() });
const transitionIdSchema = z.object({
  transitionId: z.string().uuid(),
});

const handleError = (res: Response, error: unknown) => {
  console.error("[employeeEmploymentController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu chuyển trạng thái lao động không hợp lệ.",
        zh: "劳动状态转换数据无效。",
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
      vi: "Không thể xử lý trạng thái lao động.",
      zh: "无法处理劳动状态。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getEmployeeEmploymentTransitionsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = profileIdSchema.parse(req.params);
    const data = await fetchEmployeeEmploymentTransitions(
      id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải lịch sử trạng thái lao động.",
      zh: "劳动状态历史已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createEmployeeEmploymentTransitionHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = profileIdSchema.parse(req.params);
    const input = createEmployeeEmploymentTransitionSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await createEmployeeEmploymentTransition(
      id,
      input,
      actor.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      {
        vi: "Đã ghi nhận lệnh chuyển trạng thái lao động.",
        zh: "劳动状态转换已记录。",
      },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const cancelEmployeeEmploymentTransitionHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { transitionId } = transitionIdSchema.parse(req.params);
    const input = cancelEmployeeEmploymentTransitionSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await cancelEmployeeEmploymentTransition(
      transitionId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã hủy lệnh chuyển trạng thái.",
      zh: "状态转换已取消。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const applyDueEmployeeEmploymentTransitionsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const configuredSecret = process.env.EMPLOYEE_EMPLOYMENT_CRON_SECRET;
    if (!hasNonEmptySecret(configuredSecret)) {
      return sendError(
        res,
        {
          vi: "Chưa cấu hình khóa bảo mật cho lịch trạng thái lao động.",
          zh: "尚未配置劳动状态定时任务密钥。",
        },
        503,
      );
    }
    if (!securelyMatchesSecret(req.header("x-cron-secret"), configuredSecret)) {
      return sendError(
        res,
        {
          vi: "Khóa bảo mật lịch không hợp lệ.",
          zh: "定时任务密钥无效。",
        },
        401,
      );
    }
    const data = await applyDueEmployeeEmploymentTransitions(
      "system:cloud-scheduler:employee-employment",
    );
    return sendSuccess(res, data, {
      vi: "Đã xử lý các lệnh chuyển trạng thái đến hạn.",
      zh: "已处理到期的劳动状态转换。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
