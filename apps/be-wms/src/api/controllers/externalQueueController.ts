import { Request, Response } from "express";
import { db } from "../../config/firebase.js";
import { ExternalScanQueue, ExternalScanQueueStatus } from "@bduck/shared-types";
import * as externalScanService from "../../services/externalScanService.js";
import { locationRepository } from "../../repositories/locationRepository.js";
import { productRepository } from "../../repositories/productRepository.js";
import { warehouseRepository } from "../../repositories/warehouseRepository.js";
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

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(value as string | number);
};

const toQueueDate = (value: unknown) => toDate(value).toISOString().slice(0, 10);

const getOperatorDisplayName = (record: ExternalScanQueue) => {
  const operatorName = record.operator_name?.trim();
  if (operatorName && !operatorName.includes("@")) return operatorName;
  return record.operator_id_external || operatorName || "Unknown";
};

export const getPendingBatches = async (req: Request, res: Response) => {
  try {
    // Query both QUEUED (đang quét, chưa submit batch) and SUBMITTED (đã gửi batch chờ duyệt)
    const [queuedSnapshot, submittedSnapshot] = await Promise.all([
      db
        .collection("external_scan_queue")
        .where("status", "==", ExternalScanQueueStatus.QUEUED)
        .get(),
      db
        .collection("external_scan_queue")
        .where("status", "==", ExternalScanQueueStatus.SUBMITTED)
        .get(),
    ]);

    const allRecords = [...queuedSnapshot.docs, ...submittedSnapshot.docs]
      .map(doc => doc.data() as ExternalScanQueue)
      .filter(record => !record.is_deleted);
    const products = await productRepository.findByIds(
      allRecords.map((record) => record.product_id),
    );
    const productById = new Map(products.map((product) => [product.id, product]));
    const uniqueLocationIds = [...new Set(allRecords.map((record) => record.warehouse_location_id))];
    const uniqueWarehouseIds = [...new Set(allRecords.map((record) => record.warehouse_id))];
    const [locationPairs, warehousePairs] = await Promise.all([
      Promise.all(uniqueLocationIds.map(async (id) => [id, await locationRepository.findById(id)] as const)),
      Promise.all(uniqueWarehouseIds.map(async (id) => [id, await warehouseRepository.findById(id)] as const)),
    ]);
    const locationById = new Map(locationPairs);
    const warehouseById = new Map(warehousePairs);

    // Group: SUBMITTED → by batch_id, QUEUED → by warehouse_location_id + operator
    const batchMap = new Map<string, any>();

    for (const record of allRecords) {
      // SUBMITTED records must have batch_id; QUEUED records may not
      const queueDate = toQueueDate(record.scan_time);
      const product = productById.get(record.product_id);
      const location = locationById.get(record.warehouse_location_id);
      const warehouse = warehouseById.get(record.warehouse_id);
      const operatorDisplayName = getOperatorDisplayName(record);
      const groupKey = record.batch_id
        ? record.batch_id
        : `DRAFT-${record.warehouse_location_id}-${queueDate}`;

      if (!batchMap.has(groupKey)) {
        batchMap.set(groupKey, {
          batch_id: groupKey,
          warehouse_id: record.warehouse_id,
          warehouse_name: warehouse?.name ?? null,
          warehouse_code: warehouse?.code ?? null,
          warehouse_location_id: record.warehouse_location_id,
          location_name: location?.name ?? null,
          location_code: location?.code ?? null,
          operator_name: operatorDisplayName,
          operator_names: [],
          queue_date: queueDate,
          shift_date: record.scan_time,
          last_scan_time: record.scan_time,
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
      if (!batch.operator_names.includes(operatorDisplayName)) {
        batch.operator_names.push(operatorDisplayName);
      }
      if (toDate(record.scan_time).getTime() > toDate(batch.last_scan_time).getTime()) {
        batch.last_scan_time = record.scan_time;
      }
      batch.total_quantity += record.quantity;
      batch.total_value += record.quantity * record.unit_price;

      const existingItem = batch.items.find((i: any) => i.product_id === record.product_id);
      if (!existingItem) {
        batch.total_products += 1;
      }

      batch.items.push({
        scan_id: record.id,
        product_id: record.product_id,
        product_name: product?.name ?? null,
        product_code: product?.code ?? null,
        product_barcode: product?.barcode ?? null,
        product_unit: product?.unit ?? null,
        product_image_url:
          product?.product_image_url && product.product_image_url.length > 0
            ? product.product_image_url[0]
            : null,
        barcode: record.barcode_scanned,
        quantity: record.quantity,
        unit_price: record.unit_price,
        scan_time: record.scan_time,
        operator_name: operatorDisplayName,
        operator_id_external: record.operator_id_external,
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
      const operatorDisplayName = getOperatorDisplayName(record);
      
      if (!batchMap.has(record.batch_id)) {
        batchMap.set(record.batch_id, {
          batch_id: record.batch_id,
          status: record.status,
          operator_name: operatorDisplayName,
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
        hasScopedPermission(user, "external_scan.edit_quantity", warehouseId) ||
        hasScopedPermission(user, "external_scan.manage_queue", warehouseId),
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

const cancelScanSchema = z.object({
  scan_id: z.string(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const cancelScan = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const parsed = cancelScanSchema.parse(req.body);

    const result = await externalScanService.cancelScanByManager(
      parsed.scan_id,
      user.id,
      (warehouseId) =>
        hasScopedPermission(user, "external_scan.manage_queue", warehouseId),
      parsed.reason || null,
    );

    return res.status(200).json({
      success: true,
      data: result,
      messages: { vi: "Da huy muc hang cho.", zh: "队列项已取消。" },
    });
  } catch (error: any) {
    console.error("[cancelScan]", error);
    const status = error.message === "PERMISSION_DENIED" ? 403 : 400;
    return res.status(status).json({
      success: false,
      data: null,
      messages: { vi: "Loi khi huy hang cho: " + error.message, zh: "取消队列项失败。" },
    });
  }
};

const autoSubmitSchema = z.object({
  warehouse_id: z.string().optional(),
  warehouse_location_id: z.string().optional(),
  older_than_minutes: z.number().int().min(1).max(1440).default(30),
});

export const autoSubmitQueuedLocations = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const parsed = autoSubmitSchema.parse(req.body ?? {});

    if (
      parsed.warehouse_id &&
      !hasScopedPermission(user, "external_scan.manage_queue", parsed.warehouse_id)
    ) {
      return res.status(403).json({
        success: false,
        data: null,
        messages: { vi: "Khong co quyen quan ly hang cho kho nay.", zh: "无权管理此仓库队列。" },
      });
    }

    const result = await externalScanService.autoSubmitQueuedLocations({
      actorId: user.id,
      warehouseId: parsed.warehouse_id,
      warehouseLocationId: parsed.warehouse_location_id,
      olderThanMinutes: parsed.older_than_minutes,
    });

    return res.status(200).json({
      success: true,
      data: result,
      messages: { vi: "Da chay auto-submit theo quay.", zh: "已按柜台执行自动提交。" },
    });
  } catch (error: any) {
    console.error("[autoSubmitQueuedLocations]", error);
    return res.status(400).json({
      success: false,
      data: null,
      messages: { vi: "Loi auto-submit: " + error.message, zh: "自动提交失败。" },
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
  cancelScan,
  autoSubmitQueuedLocations,
  rejectBatch,
};
