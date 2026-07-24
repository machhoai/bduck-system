import type { Request, Response } from "express";
import { z } from "zod";
import {
  decideLeaveApprovalTask,
  fetchMyLeaveApprovalTasks,
  fetchUnavailableLeaveApprovalTasks,
  reassignLeaveApprovalTask,
} from "../../services/leaveApprovalService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const safeReason = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => !/\$(where|ne|gt|lt)\b/i.test(value));
const decideSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: safeReason,
    action_time: z.coerce.date(),
  })
  .strict()
  .refine(
    (value) => value.decision !== "REJECT" || value.reason.length > 0,
    { path: ["reason"] },
  );
const assignmentSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("ROLE"),
      role_id: z.string().trim().min(1).max(128),
      assigned_user_id: z.null(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("USER"),
      role_id: z.null(),
      assigned_user_id: z.string().trim().min(1).max(128),
    })
    .strict(),
]);
const reassignSchema = z
  .object({
    assignment: assignmentSchema,
    reason: safeReason.min(1),
    action_time: z.coerce.date(),
  })
  .strict();

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveApprovalController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu duyệt nghỉ phép không hợp lệ.", zh: "休假审批数据无效。" },
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
      vi: "Không thể xử lý duyệt nghỉ phép.",
      zh: "无法处理休假审批。",
    },
    apiError.statusCode ?? 500,
  );
};

export const listMyLeaveApprovalTasksHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await fetchMyLeaveApprovalTasks(
        actor.id,
        requireRequestAuthorization(req),
      ),
      { vi: "Đã tải danh sách chờ duyệt.", zh: "待审批列表已加载。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const listUnavailableLeaveApprovalTasksHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await fetchUnavailableLeaveApprovalTasks(
        actor.id,
        requireRequestAuthorization(req),
      ),
      { vi: "Đã tải danh sách thiếu người duyệt.", zh: "无可用审批人的列表已加载。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const decideLeaveApprovalTaskHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const input = decideSchema.parse(req.body);
    return sendSuccess(
      res,
      await decideLeaveApprovalTask(
        z.string().min(1).max(200).parse(req.params.id),
        input,
        actor.id,
        requireRequestAuthorization(req),
      ),
      input.decision === "APPROVE"
        ? { vi: "Đã duyệt đơn nghỉ phép.", zh: "休假申请已批准。" }
        : { vi: "Đã từ chối đơn nghỉ phép.", zh: "休假申请已拒绝。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const reassignLeaveApprovalTaskHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await reassignLeaveApprovalTask(
        z.string().min(1).max(200).parse(req.params.id),
        reassignSchema.parse(req.body),
        actor.id,
        requireRequestAuthorization(req),
      ),
      { vi: "Đã chỉ định lại người duyệt.", zh: "审批人已重新指派。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};
