import { ExternalScanQueueStatus } from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import * as scopedQueueService from "../../services/scopedExternalQueueService.js";
import { buildExternalQueueBatchViews } from "../../services/externalQueueViewService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown): void => {
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi tải hàng chờ quét.",
      zh: "加载扫描队列失败。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
  );
};

export const getPendingBatches = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const authorization = requireRequestAuthorization(req);
    const records =
      await scopedQueueService.findPendingQueueRecords(authorization);
    sendSuccess(
      res,
      await buildExternalQueueBatchViews(records, authorization, false),
      {
        vi: "Đã tải danh sách chờ xử lý.",
        zh: "待处理列表已加载。",
      },
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const getHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const status = z
      .nativeEnum(ExternalScanQueueStatus)
      .optional()
      .parse(req.query.status);
    const facilityId = z
      .string()
      .trim()
      .min(1)
      .optional()
      .parse(req.query.warehouse_id);
    const authorization = requireRequestAuthorization(req);
    const records = await scopedQueueService.findQueueHistoryRecords(
      authorization,
      status,
      facilityId,
    );
    sendSuccess(
      res,
      await buildExternalQueueBatchViews(records, authorization, true),
      {
        vi: "Đã tải lịch sử hàng chờ.",
        zh: "扫描队列历史已加载。",
      },
    );
  } catch (error) {
    handleError(res, error);
  }
};
