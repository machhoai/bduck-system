import {
  ExternalCountCheckpointType,
  StockCountItemCondition,
  type IntegrationClient,
} from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  getExternalCountState,
  submitExternalCountCheckpoint,
} from "../../services/stockCountService.js";
import {
  getExternalCountDetail,
  listExternalCountSessions,
} from "../../services/scopedStockCountService.js";
import {
  getExternalCountRequirement,
  updateExternalCountRequirement,
  updateExternalCountRequirementSchema,
} from "../../services/externalCountConfigService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const itemSchema = z.object({
  barcode: z.string().trim().min(1).optional().nullable(),
  product_id: z.string().trim().min(1).optional().nullable(),
  counted_quantity: z.number().int().min(0),
  base_atp: z.number().int().min(0).optional().nullable(),
  condition: z
    .nativeEnum(StockCountItemCondition)
    .default(StockCountItemCondition.GOOD),
  evidence_urls: z.array(z.string().url()).default([]),
  notes: z.string().trim().max(500).optional().nullable(),
});
const checkpointSchema = z.object({
  warehouse_id: z.string().min(1),
  warehouse_location_id: z.string().min(1),
  checkpoint_type: z.nativeEnum(ExternalCountCheckpointType),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotency_key: z.string().trim().min(8).max(160),
  external_operator_name: z.string().trim().max(120).optional().nullable(),
  external_operator_id: z.string().trim().max(120).optional().nullable(),
  device_id: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  action_time: z.string().datetime().optional(),
  items: z.array(itemSchema).min(1).max(500),
});
const listSchema = z.object({
  warehouse_id: z.string().optional(),
  warehouse_location_id: z.string().optional(),
  status: z.string().optional(),
  business_date: z.string().optional(),
});
const stateSchema = z.object({
  warehouse_id: z.string().min(1),
  warehouse_location_id: z.string().min(1),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const integrationClient = (req: Request): IntegrationClient =>
  (req as Request & { integrationClient: IntegrationClient }).integrationClient;

const handleError = (res: Response, error: unknown): void => {
  console.error("[stockCountController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi khi xử lý checkpoint kiểm đếm.",
      zh: "处理盘点检查点时出错。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
  );
};

export const submitExternalCountCheckpointHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await submitExternalCountCheckpoint(
      checkpointSchema.parse(req.body),
      integrationClient(req),
      req.ip || req.socket.remoteAddress || "",
      getAuditRequestMetadata(req),
    );
    sendSuccess(
      res,
      data,
      { vi: "Đã ghi nhận checkpoint kiểm đếm.", zh: "盘点检查点已记录。" },
      201,
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const getExternalCountStateHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const query = stateSchema.parse(req.query);
    if (
      !integrationClient(req).allowed_warehouse_ids.includes(query.warehouse_id)
    ) {
      sendError(
        res,
        {
          vi: "Client không có quyền với cơ sở này.",
          zh: "客户端无权访问该设施。",
        },
        403,
      );
      return;
    }
    const data = await getExternalCountState({
      warehouseId: query.warehouse_id,
      warehouseLocationId: query.warehouse_location_id,
      businessDate: query.business_date,
    });
    sendSuccess(res, data, {
      vi: "Đã tải trạng thái kiểm đếm.",
      zh: "盘点状态已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const listExternalCountsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await listExternalCountSessions(
      listSchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Đã tải checkpoint kiểm đếm.",
      zh: "盘点检查点已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getExternalCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await getExternalCountDetail(
      z.string().trim().min(1).max(128).parse(req.params.id),
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

export const getExternalCountRequirementHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    sendSuccess(res, await getExternalCountRequirement(), {
      vi: "Đã tải cấu hình kiểm đếm external.",
      zh: "外部盘点配置已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateExternalCountRequirementHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await updateExternalCountRequirement(
      updateExternalCountRequirementSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
    );
    sendSuccess(res, data, {
      vi: "Đã cập nhật cấu hình kiểm đếm external.",
      zh: "外部盘点配置已更新。",
    });
  } catch (error) {
    handleError(res, error);
  }
};
