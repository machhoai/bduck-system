import { Request, Response } from "express";
import { db } from "../../config/firebase.js";
import { ExternalScanQueue, ExternalScanQueueStatus } from "@bduck/shared-types";
import * as externalScanService from "../../services/externalScanService.js";
import { z } from "zod";

const hasScopedPermission = (
  user: any,
  permission: string,
  warehouseId?: string | null,
) => {
  const permissions = user?.permissions as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!permissions) return false;

  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[permission] === true) return true;

  if (warehouseId) {
    const warehousePerms = permissions[warehouseId] || {};
    return (
      warehousePerms["*"] === true || warehousePerms[permission] === true
    );
  }

  return Object.values(permissions).some(
    (scopedPermissions) =>
      scopedPermissions["*"] === true ||
      scopedPermissions[permission] === true,
  );
};

export const getPendingBatches = async (req: Request, res: Response) => {
  try {
    // Query both QUEUED (đang quét, chưa submit batch) and SUBMITTED (đã gửi batch chờ duyệt)
    const snapshot = await db
      .collection("external_scan_queue")
      .where("status", "in", [ExternalScanQueueStatus.QUEUED, ExternalScanQueueStatus.SUBMITTED])
      .where("is_deleted", "==", false)
      .get();

    const allRecords = snapshot.docs.map(doc => doc.data() as ExternalScanQueue);

    // Group: SUBMITTED → by batch_id, QUEUED → by warehouse_location_id + operator
    const batchMap = new Map<string, any>();

    for (const record of allRecords) {
      // SUBMITTED records must have batch_id; QUEUED records may not
      const groupKey = record.batch_id
        ? record.batch_id
        : `DRAFT-${record.warehouse_location_id}-${record.operator_id_external || record.operator_name}`;

      if (!batchMap.has(groupKey)) {
        batchMap.set(groupKey, {
          batch_id: groupKey,
          warehouse_id: record.warehouse_id,
          warehouse_location_id: record.warehouse_location_id,
          operator_name: record.operator_name,
          shift_date: record.scan_time,
          submitted_at: record.batch_id ? record.sync_time : null,
          status: record.status, // QUEUED or SUBMITTED
          is_draft: !record.batch_id, // true nếu chưa batch-submit
          total_products: 0,
          total_quantity: 0,
          total_value: 0,
          items: [],
        });
      }

      const batch = batchMap.get(groupKey);
      batch.total_quantity += record.quantity;
      batch.total_value += record.quantity * record.unit_price;

      const existingItem = batch.items.find((i: any) => i.product_id === record.product_id);
      if (!existingItem) {
        batch.total_products += 1;
      }

      batch.items.push({
        scan_id: record.id,
        product_id: record.product_id,
        barcode: record.barcode_scanned,
        quantity: record.quantity,
        unit_price: record.unit_price,
        scan_time: record.scan_time,
      });
    }

    // Sort: SUBMITTED first (chờ duyệt ưu tiên), then QUEUED (đang quét)
    const sorted = Array.from(batchMap.values()).sort((a, b) => {
      if (a.status === ExternalScanQueueStatus.SUBMITTED && b.status !== ExternalScanQueueStatus.SUBMITTED) return -1;
      if (a.status !== ExternalScanQueueStatus.SUBMITTED && b.status === ExternalScanQueueStatus.SUBMITTED) return 1;
      return 0;
    });

    return res.status(200).json({
      success: true,
      data: sorted,
    });
  } catch (error) {
    console.error("[getPendingBatches]", error);
    return res.status(500).json({ success: false, data: null, messages: { vi: "Lỗi server", zh: "服务器错误" } });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const warehouseId = req.query.warehouse_id as string;
    
    let query = db.collection("external_scan_queue").where("is_deleted", "==", false);

    if (status) {
      query = query.where("status", "==", status);
    } else {
      query = query.where("status", "in", [
        ExternalScanQueueStatus.APPROVED,
        ExternalScanQueueStatus.EXPORTED,
        ExternalScanQueueStatus.REJECTED
      ]);
    }

    if (warehouseId) {
      query = query.where("warehouse_id", "==", warehouseId);
    }

    const snapshot = await query.get();
    const allRecords = snapshot.docs.map(doc => doc.data() as ExternalScanQueue);

    const batchMap = new Map<string, any>();
    for (const record of allRecords) {
      if (!record.batch_id) continue;
      
      if (!batchMap.has(record.batch_id)) {
        batchMap.set(record.batch_id, {
          batch_id: record.batch_id,
          status: record.status,
          operator_name: record.operator_name,
          location_name: "Location",
          shift_date: record.scan_time,
          total_products: 0,
          total_quantity: 0,
          total_value: 0,
          approved_by_name: record.approved_by, // Should join user name
          approved_at: record.approved_at,
          export_voucher_id: record.export_voucher_id,
        });
      }

      const batch = batchMap.get(record.batch_id);
      batch.total_quantity += record.quantity;
      batch.total_value += record.quantity * record.unit_price;
      batch.total_products += 1; // Simplified
    }

    return res.status(200).json({
      success: true,
      data: Array.from(batchMap.values()),
    });
  } catch (error) {
    console.error("[getHistory]", error);
    return res.status(500).json({ success: false, data: null, messages: { vi: "Lỗi server", zh: "服务器错误" } });
  }
};

const approveSchema = z.object({
  batch_id: z.string(),
  approved_items: z.array(z.object({
    scan_id: z.string(),
    quantity: z.number().int().min(0),
  })),
  notes: z.string().nullable(),
});

export const approveBatch = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const parsed = approveSchema.parse(req.body);

    const result = await externalScanService.approveBatch(
      parsed.batch_id,
      user.id,
      parsed.approved_items,
      parsed.notes,
      (warehouseId) =>
        hasScopedPermission(user, "external_scan.edit_quantity", warehouseId),
    );

    return res.status(200).json({
      success: true,
      data: result,
      messages: { vi: "Đã duyệt thành công.", zh: "批准成功。" },
    });
  } catch (error: any) {
    console.error("[approveBatch]", error);
    return res.status(400).json({
      success: false,
      data: null,
      messages: { vi: "Lỗi khi duyệt: " + error.message, zh: "批准错误" },
    });
  }
};

const updateQuantitySchema = z.object({
  scan_id: z.string(),
  quantity: z.number().int().min(0),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const updateScanQuantity = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const parsed = updateQuantitySchema.parse(req.body);

    const result = await externalScanService.updateScanQuantity(
      parsed.scan_id,
      parsed.quantity,
      user.id,
      (warehouseId) =>
        hasScopedPermission(user, "external_scan.edit_quantity", warehouseId),
      parsed.reason || null,
    );

    return res.status(200).json({
      success: true,
      data: result,
      messages: { vi: "Đã cập nhật số lượng.", zh: "数量已更新。" },
    });
  } catch (error: any) {
    console.error("[updateScanQuantity]", error);
    const status = error.message === "PERMISSION_DENIED" ? 403 : 400;
    return res.status(status).json({
      success: false,
      data: null,
      messages: { vi: "Lỗi khi cập nhật số lượng: " + error.message, zh: "更新数量错误" },
    });
  }
};

const rejectSchema = z.object({
  batch_id: z.string(),
  reason: z.string(),
});

export const rejectBatch = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const parsed = rejectSchema.parse(req.body);

    await externalScanService.rejectBatch(parsed.batch_id, user.id, parsed.reason);

    return res.status(200).json({
      success: true,
      data: null,
      messages: { vi: "Đã từ chối batch.", zh: "拒绝成功。" },
    });
  } catch (error: any) {
    console.error("[rejectBatch]", error);
    return res.status(400).json({
      success: false,
      data: null,
      messages: { vi: "Lỗi khi từ chối: " + error.message, zh: "拒绝错误" },
    });
  }
};

export default {
  getPendingBatches,
  getHistory,
  approveBatch,
  updateScanQuantity,
  rejectBatch,
};
