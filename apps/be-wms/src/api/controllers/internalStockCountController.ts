import { StockCountItemCondition } from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  cancelInternalStockCountSession,
  createInternalStockCountSession,
  getInternalStockCountDetail,
  listInternalStockCountSessions,
  submitInternalStockCountSession,
  updateInternalStockCountItem,
} from "../../services/scopedStockCountService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const idSchema = z.string().trim().min(1).max(128);
const listSchema = z.object({
  warehouse_id: z.string().optional(),
  warehouse_location_id: z.string().optional(),
  status: z.string().optional(),
  business_date: z.string().optional(),
});
const createSchema = z.object({
  warehouse_id: z.string().min(1),
  count_scope: z.enum(["WAREHOUSE", "LOCATION", "CATEGORY", "PRODUCT"]),
  warehouse_location_ids: z.array(z.string().min(1)).default([]),
  product_ids: z.array(z.string().min(1)).default([]),
  category_id: z.string().min(1).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  blind_count_enabled: z.boolean().default(false),
  action_time: z.string().datetime().optional(),
});
const itemSchema = z.object({
  counted_quantity: z.number().int().min(0),
  condition: z
    .nativeEnum(StockCountItemCondition)
    .default(StockCountItemCondition.GOOD),
  evidence_urls: z.array(z.string().url()).default([]),
  discrepancy_reason: z.string().trim().max(120).optional().nullable(),
  discrepancy_note: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  action_time: z.string().datetime().optional(),
});
const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const handleError = (res: Response, error: unknown): void => {
  console.error("[internalStockCountController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi khi xử lý phiên kiểm đếm.",
      zh: "处理盘点会话时出错。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
  );
};

export const listInternalStockCountsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await listInternalStockCountSessions(
      listSchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Đã tải phiên kiểm đếm.",
      zh: "盘点会话已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getInternalStockCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await getInternalStockCountDetail(
      idSchema.parse(req.params.id),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Đã tải chi tiết kiểm đếm.",
      zh: "盘点详情已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const createInternalStockCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await createInternalStockCountSession(
      createSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      req.ip || req.socket.remoteAddress || "",
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    sendSuccess(
      res,
      data,
      { vi: "Đã tạo phiên kiểm đếm.", zh: "盘点会话已创建。" },
      201,
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const updateInternalStockCountItemHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await updateInternalStockCountItem(
      idSchema.parse(req.params.id),
      idSchema.parse(req.params.itemId),
      itemSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Đã lưu số lượng kiểm đếm.",
      zh: "盘点数量已保存。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const submitInternalStockCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await submitInternalStockCountSession(
      idSchema.parse(req.params.id),
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Đã nộp phiên kiểm đếm.",
      zh: "盘点会话已提交。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const cancelInternalStockCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = cancelSchema.parse(req.body);
    const data = await cancelInternalStockCountSession(
      idSchema.parse(req.params.id),
      input.reason,
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Đã hủy phiên kiểm đếm.",
      zh: "盘点会话已取消。",
    });
  } catch (error) {
    handleError(res, error);
  }
};
