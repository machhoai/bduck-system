import type { Request, Response } from "express";
import { z } from "zod";
import {
  ExternalCountCheckpointType,
  StockCountItemCondition,
} from "@bduck/shared-types";
import {
  getExternalCountDetail,
  getExternalCountState,
  listExternalCountSessions,
  submitExternalCountCheckpoint,
} from "../../services/stockCountService.js";
import {
  getExternalCountRequirement,
  updateExternalCountRequirement,
  updateExternalCountRequirementSchema,
} from "../../services/externalCountConfigService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const countItemSchema = z.object({
  barcode: z.string().trim().min(1).optional().nullable(),
  product_id: z.string().trim().min(1).optional().nullable(),
  counted_quantity: z.number().int().min(0),
  base_atp: z.number().int().min(0).optional().nullable(),
  condition: z.nativeEnum(StockCountItemCondition).default(StockCountItemCondition.GOOD),
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
  items: z.array(countItemSchema).min(1).max(500),
});

const listQuerySchema = z.object({
  warehouse_id: z.string().optional(),
  warehouse_location_id: z.string().optional(),
  status: z.string().optional(),
  business_date: z.string().optional(),
});

const stateQuerySchema = z.object({
  warehouse_id: z.string().min(1),
  warehouse_location_id: z.string().min(1),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const hasScopedPermission = (user: any, permission: string, warehouseId?: string | null) => {
  const permissions = user?.permissions as Record<string, Record<string, unknown>> | undefined;
  if (!permissions) return false;
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[permission] === true) return true;
  if (!warehouseId) return Object.values(permissions).some((scope) => scope["*"] === true || scope[permission] === true);
  const scoped = permissions[warehouseId] || {};
  return scoped["*"] === true || scoped[permission] === true;
};

function handleError(res: Response, error: any, fallback: string) {
  console.error("[stockCountController]", error);
  return res.status(error?.statusCode || 400).json({
    success: false,
    data: null,
    messages: error?.messages || { vi: `${fallback}: ${error?.message || ""}`, zh: fallback },
  });
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export async function submitExternalCountCheckpointHandler(req: Request, res: Response) {
  try {
    const client = (req as any).integrationClient;
    const input = checkpointSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || "";
    const data = await submitExternalCountCheckpoint(
      input,
      client,
      clientIp,
      getAuditRequestMetadata(req),
    );

    return res.status(201).json({
      success: true,
      data,
      messages: {
        vi: "Da ghi nhan checkpoint kiem dem.",
        zh: "盘点检查点已记录。",
      },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi ghi nhan checkpoint kiem dem");
  }
}

export async function getExternalCountStateHandler(req: Request, res: Response) {
  try {
    const client = (req as any).integrationClient;
    const query = stateQuerySchema.parse(req.query);
    if (!client.allowed_warehouse_ids.includes(query.warehouse_id)) {
      return res.status(403).json({
        success: false,
        data: null,
        messages: { vi: "Client khong co quyen voi kho nay.", zh: "客户端无权访问该仓库。" },
      });
    }
    const data = await getExternalCountState({
      warehouseId: query.warehouse_id,
      warehouseLocationId: query.warehouse_location_id,
      businessDate: query.business_date,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Loi khi tai trang thai kiem dem");
  }
}

export async function listExternalCountsHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const query = listQuerySchema.parse(req.query);
    const data = await listExternalCountSessions(query);
    const filtered = data.filter((session: any) =>
      hasScopedPermission(user, "external_count.view", session.warehouse_id) ||
      hasScopedPermission(user, "external_count.count", session.warehouse_id),
    );
    return res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    return handleError(res, error, "Loi khi tai checkpoint kiem dem");
  }
}

export async function getExternalCountHandler(req: Request, res: Response) {
  try {
    const detail = await getExternalCountDetail(param(req.params.id));
    return res.status(200).json({ success: true, data: detail });
  } catch (error) {
    return handleError(res, error, "Loi khi tai chi tiet kiem dem");
  }
}

export async function getExternalCountRequirementHandler(_req: Request, res: Response) {
  try {
    const data = await getExternalCountRequirement();
    return res.status(200).json({
      success: true,
      data,
      messages: { vi: "Da tai cau hinh kiem dem external.", zh: "外部盘点配置已加载。" },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi tai cau hinh kiem dem");
  }
}

export async function updateExternalCountRequirementHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const input = updateExternalCountRequirementSchema.parse(req.body);
    const data = await updateExternalCountRequirement(input, user.id);
    return res.status(200).json({
      success: true,
      data,
      messages: { vi: "Da cap nhat cau hinh kiem dem external.", zh: "外部盘点配置已更新。" },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi cap nhat cau hinh kiem dem");
  }
}
