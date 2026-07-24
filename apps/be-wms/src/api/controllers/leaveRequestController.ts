import {
  LeaveDayPortion,
  LeaveRequestType,
} from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  cancelMyLeaveRequest,
  createMyLeaveRequest,
  fetchMyLeaveRequests,
  submitMyLeaveRequest,
} from "../../services/leaveRequestService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const safeReason = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => !/\$(where|ne|gt|lt)\b/i.test(value));
const actionSchema = z
  .object({ action_time: z.coerce.date() })
  .strict();
const createSchema = z
  .object({
    request_type: z.nativeEnum(LeaveRequestType),
    days: z
      .array(
        z
          .object({
            date: z.string().date(),
            portion: z.nativeEnum(LeaveDayPortion),
          })
          .strict(),
      )
      .min(1)
      .max(31),
    reason: safeReason,
    submit: z.boolean(),
    action_time: z.coerce.date(),
  })
  .strict();
const cancelSchema = z
  .object({
    reason: safeReason,
    action_time: z.coerce.date(),
  })
  .strict();

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveRequestController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu đơn nghỉ phép không hợp lệ.",
        zh: "休假申请数据无效。",
      },
      400,
      error.flatten(),
    );
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    issues?: unknown;
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý đơn nghỉ phép.",
      zh: "无法处理休假申请。",
    },
    apiError.statusCode ?? 500,
    apiError.issues ?? null,
  );
};

export const listMyLeaveRequestsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const data = await fetchMyLeaveRequests(
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải lịch sử xin nghỉ phép.",
      zh: "休假申请历史已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createMyLeaveRequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const data = await createMyLeaveRequest(
      createSchema.parse(req.body),
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(
      res,
      data,
      data.status === "DRAFT"
        ? { vi: "Đã lưu đơn nháp.", zh: "草稿已保存。" }
        : { vi: "Đã gửi đơn xin nghỉ phép.", zh: "休假申请已提交。" },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const submitMyLeaveRequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const input = actionSchema.parse(req.body);
    const data = await submitMyLeaveRequest(
      z.string().uuid().parse(req.params.id),
      actor.id,
      input.action_time,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã gửi đơn xin nghỉ phép.",
      zh: "休假申请已提交。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const cancelMyLeaveRequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const input = cancelSchema.parse(req.body);
    const data = await cancelMyLeaveRequest(
      z.string().uuid().parse(req.params.id),
      input.reason,
      input.action_time,
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã hủy đơn nghỉ phép và hoàn trả số dư đang giữ.",
      zh: "休假申请已取消，冻结余额已释放。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
