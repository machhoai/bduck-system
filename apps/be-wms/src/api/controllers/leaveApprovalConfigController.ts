import type { Request, Response } from "express";
import { z } from "zod";
import {
  fetchLeaveApprovalConfig,
  fetchLeaveApprovalConfigOptions,
  upsertLeaveApprovalConfig,
} from "../../services/leaveApprovalConfigService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

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
const configSchema = z
  .object({
    levels: z
      .array(
        z
          .object({
            level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            enabled: z.boolean(),
            label: z
              .object({
                vi: z.string().trim().min(1).max(100),
                zh: z.string().trim().min(1).max(100),
              })
              .strict(),
            assignment: assignmentSchema,
          })
          .strict(),
      )
      .min(1)
      .max(3),
    action_time: z.coerce.date(),
  })
  .strict();

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveApprovalConfigController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Cấu hình duyệt không hợp lệ.", zh: "审批配置无效。" },
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
      vi: "Không thể xử lý cấu hình duyệt nghỉ phép.",
      zh: "无法处理休假审批配置。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getLeaveApprovalConfigHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    return sendSuccess(
      res,
      await fetchLeaveApprovalConfig(requireRequestAuthorization(req)),
      { vi: "Đã tải cấu hình duyệt.", zh: "审批配置已加载。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const getLeaveApprovalConfigOptionsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    return sendSuccess(
      res,
      await fetchLeaveApprovalConfigOptions(requireRequestAuthorization(req)),
      { vi: "Đã tải danh sách người duyệt.", zh: "审批人选项已加载。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const putLeaveApprovalConfigHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await upsertLeaveApprovalConfig(
        configSchema.parse(req.body),
        actor.id,
        requireRequestAuthorization(req),
      ),
      { vi: "Đã cập nhật cấu hình duyệt.", zh: "审批配置已更新。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};
