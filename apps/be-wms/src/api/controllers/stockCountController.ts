import type { Request, Response } from "express";
import { z } from "zod";
import {
  StockCountItemCondition,
  StockCountPurpose,
} from "@bduck/shared-types";
import {
  cancelExternalCountSession,
  createExternalCountSession,
  getExternalCountDetail,
  listExternalCountSessions,
  submitExternalCountSession,
  updateExternalCountItem,
} from "../../services/stockCountService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const createSchema = z.object({
  warehouse_id: z.string().min(1),
  warehouse_location_id: z.string().min(1),
  count_purpose: z.nativeEnum(StockCountPurpose),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blind_count_enabled: z.boolean().default(false),
  external_operator_name: z.string().trim().max(120).optional().nullable(),
  external_operator_id: z.string().trim().max(120).optional().nullable(),
  device_id: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  action_time: z.string().datetime().optional(),
});

const querySchema = z.object({
  warehouse_id: z.string().optional(),
  warehouse_location_id: z.string().optional(),
  status: z.string().optional(),
  business_date: z.string().optional(),
});

const itemSchema = z.object({
  counted_quantity: z.number().int().min(0),
  condition: z.nativeEnum(StockCountItemCondition).default(StockCountItemCondition.GOOD),
  notes: z.string().trim().max(500).optional().nullable(),
  action_time: z.string().datetime().optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
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

export async function listExternalCountsHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const query = querySchema.parse(req.query);
    const data = await listExternalCountSessions(query);
    const filtered = data.filter((session: any) =>
      hasScopedPermission(user, "external_count.view", session.warehouse_id) ||
      hasScopedPermission(user, "external_count.count", session.warehouse_id),
    );
    return res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    return handleError(res, error, "Loi khi tai phien kiem dem");
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

export async function createExternalCountHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const input = createSchema.parse(req.body);
    if (!hasScopedPermission(user, "external_count.count", input.warehouse_id)) {
      return res.status(403).json({
        success: false,
        data: null,
        messages: { vi: "Khong co quyen tao phien kiem dem quay nay.", zh: "无权创建该柜台盘点。" },
      });
    }
    const data = await createExternalCountSession(input, user.id, getAuditRequestMetadata(req));
    return res.status(201).json({
      success: true,
      data,
      messages: { vi: "Da tao phien kiem dem.", zh: "盘点会话已创建。" },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi tao phien kiem dem");
  }
}

export async function updateExternalCountItemHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const input = itemSchema.parse(req.body);
    const data = await updateExternalCountItem(
      param(req.params.id),
      param(req.params.itemId),
      input,
      user.id,
      getAuditRequestMetadata(req),
    );
    return res.status(200).json({
      success: true,
      data,
      messages: { vi: "Da luu dong kiem dem.", zh: "盘点明细已保存。" },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi luu dong kiem dem");
  }
}

export async function submitExternalCountHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const data = await submitExternalCountSession(param(req.params.id), user.id, getAuditRequestMetadata(req));
    return res.status(200).json({
      success: true,
      data,
      messages: { vi: "Da nop phien kiem dem.", zh: "盘点会话已提交。" },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi nop phien kiem dem");
  }
}

export async function cancelExternalCountHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const input = cancelSchema.parse(req.body);
    const data = await cancelExternalCountSession(
      param(req.params.id),
      input.reason,
      user.id,
      getAuditRequestMetadata(req),
    );
    return res.status(200).json({
      success: true,
      data,
      messages: { vi: "Da huy phien kiem dem.", zh: "盘点会话已取消。" },
    });
  } catch (error) {
    return handleError(res, error, "Loi khi huy phien kiem dem");
  }
}
