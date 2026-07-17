import type { ProcessEntityType } from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import * as approvalService from "../../services/scopedApprovalService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const idSchema = z.string().trim().min(1).max(128);
const approvalBodySchema = z.object({
  comments: z.string().trim().max(1000).optional().nullable(),
  otp: z.string().trim().max(20).optional().nullable(),
});
const rejectionSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  otp: z.string().trim().max(20).optional().nullable(),
});
const cancelSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  otp: z.string().trim().max(20).optional(),
});
const forceCancelSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

const entityParams = (req: Request) => ({
  entityType: idSchema.parse(req.params.entityType) as ProcessEntityType,
  entityId: idSchema.parse(req.params.entityId),
});

const handleError = (res: Response, error: unknown): void => {
  console.error("[approvalController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi khi xử lý phê duyệt.",
      zh: "处理审批时出错。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
  );
};

export const getPendingApprovals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const records = await approvalService.getPendingTasksForUser(
      requireAuthenticatedRequestUser(req),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, records, {
      vi: `Tìm thấy ${records.length} phiếu chờ duyệt.`,
      zh: `找到 ${records.length} 个待审批单据。`,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getApprovalTimeline = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { entityType, entityId } = entityParams(req);
    const records = await approvalService.getApprovalTimeline(
      entityType,
      entityId,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, records, {
      vi: "Đã tải lịch sử phê duyệt.",
      zh: "审批时间线已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const approveHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = approvalBodySchema.parse(req.body ?? {});
    const result = await approvalService.approveLevel(
      idSchema.parse(req.params.id),
      requireAuthenticatedRequestUser(req),
      input.comments,
      input.otp,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, result, {
      vi: "Đã phê duyệt thành công.",
      zh: "审批成功。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const rejectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = rejectionSchema.parse(req.body ?? {});
    await approvalService.rejectApproval(
      idSchema.parse(req.params.id),
      requireAuthenticatedRequestUser(req),
      input.reason,
      input.otp,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, null, { vi: "Đã từ chối phê duyệt.", zh: "审批已拒绝。" });
  } catch (error) {
    handleError(res, error);
  }
};

export const cancelHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = cancelSchema.parse(req.body ?? {});
    const { entityType, entityId } = entityParams(req);
    await approvalService.cancelByCreator(
      entityType,
      entityId,
      requireAuthenticatedRequestUser(req),
      input.reason,
      input.otp,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, null, {
      vi: "Đã hủy lệnh thành công.",
      zh: "单据已撤销。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const forceCancelHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = forceCancelSchema.parse(req.body ?? {});
    const { entityType, entityId } = entityParams(req);
    const user = requireAuthenticatedRequestUser(req);
    await approvalService.forceCancel(
      entityType,
      entityId,
      user.id,
      input.reason,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, null, {
      vi: "Đã hủy lệnh bằng quyền đặc biệt.",
      zh: "单据已强制撤销。",
    });
  } catch (error) {
    handleError(res, error);
  }
};
