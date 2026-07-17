import type { Request, Response } from "express";
import { z } from "zod";
import * as externalScanService from "../../services/externalScanService.js";
import * as scopedQueueService from "../../services/scopedExternalQueueService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const idSchema = z.string().trim().min(1).max(128);
const approveSchema = z.object({
  batch_id: idSchema,
  approved_items: z
    .array(
      z.object({
        scan_id: idSchema,
        quantity: z.number().int().min(0),
      }),
    )
    .min(1),
  notes: z.string().trim().max(1000).nullable(),
});
const quantitySchema = z.object({
  scan_id: idSchema,
  quantity: z.number().int().min(0),
  reason: z.string().trim().max(500).optional().nullable(),
});
const scanSchema = z.object({
  scan_id: idSchema,
  reason: z.string().trim().max(500).optional().nullable(),
});
const rejectSchema = z.object({
  batch_id: idSchema,
  reason: z.string().trim().min(1).max(1000),
});

const handleError = (res: Response, error: unknown): void => {
  console.error("[externalQueueMutationController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    message?: string;
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: `Không thể xử lý hàng chờ: ${apiError.message ?? "Lỗi hệ thống"}`,
      zh: "无法处理扫描队列。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 400),
  );
};

export const approveBatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = approveSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    const authorization = requireRequestAuthorization(req);
    await scopedQueueService.assertBatchAction(
      input.batch_id,
      "external_scan.approve",
      authorization,
    );
    const result = await externalScanService.approveBatch(
      input.batch_id,
      user.id,
      input.approved_items,
      input.notes,
      (facilityId) =>
        authorization.can("external_scan.edit_quantity", facilityId),
    );
    sendSuccess(res, result, { vi: "Đã duyệt thành công.", zh: "批准成功。" });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateScanQuantity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = quantitySchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    const authorization = requireRequestAuthorization(req);
    await scopedQueueService.assertScanActions(
      input.scan_id,
      ["external_scan.edit_quantity", "external_scan.manage_queue"],
      authorization,
    );
    const result = await externalScanService.updateScanQuantity(
      input.scan_id,
      input.quantity,
      user.id,
      (facilityId) =>
        authorization.can("external_scan.edit_quantity", facilityId) ||
        authorization.can("external_scan.manage_queue", facilityId),
      input.reason ?? null,
    );
    sendSuccess(res, result, {
      vi: "Đã cập nhật số lượng.",
      zh: "数量已更新。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const cancelScan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = scanSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    const authorization = requireRequestAuthorization(req);
    await scopedQueueService.assertScanActions(
      input.scan_id,
      ["external_scan.manage_queue"],
      authorization,
    );
    const result = await externalScanService.cancelScanByManager(
      input.scan_id,
      user.id,
      (facilityId) =>
        authorization.can("external_scan.manage_queue", facilityId),
      input.reason ?? null,
    );
    sendSuccess(res, result, {
      vi: "Đã hủy mục hàng chờ.",
      zh: "队列项已取消。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const rejectBatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = rejectSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    await scopedQueueService.assertBatchAction(
      input.batch_id,
      "external_scan.approve",
      requireRequestAuthorization(req),
    );
    await externalScanService.rejectBatch(
      input.batch_id,
      user.id,
      input.reason,
    );
    sendSuccess(res, null, { vi: "Đã từ chối batch.", zh: "拒绝成功。" });
  } catch (error) {
    handleError(res, error);
  }
};
