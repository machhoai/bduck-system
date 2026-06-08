import { Request, Response } from "express";
import { db } from "../../config/firebase.js";
import { ExternalScanQueue, ExternalScanQueueStatus } from "@bduck/shared-types";
import * as externalScanService from "../../services/externalScanService.js";
import { z } from "zod";

export const getPendingBatches = async (req: Request, res: Response) => {
  try {
    // Only SUBMITTED records
    const snapshot = await db
      .collection("external_scan_queue")
      .where("status", "==", ExternalScanQueueStatus.SUBMITTED)
      .where("is_deleted", "==", false)
      .get();

    const allRecords = snapshot.docs.map(doc => doc.data() as ExternalScanQueue);

    // Group by batch_id
    const batchMap = new Map<string, any>();

    for (const record of allRecords) {
      if (!record.batch_id) continue;
      
      if (!batchMap.has(record.batch_id)) {
        batchMap.set(record.batch_id, {
          batch_id: record.batch_id,
          warehouse_id: record.warehouse_id,
          warehouse_name: "Warehouse Name", // Ideally fetched from DB
          location_name: "Location Name", // Ideally fetched
          operator_name: record.operator_name,
          shift_date: record.scan_time, // Or from record
          submitted_at: record.sync_time,
          total_products: 0,
          total_quantity: 0,
          total_value: 0,
          items: []
        });
      }

      const batch = batchMap.get(record.batch_id);
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

    return res.status(200).json({
      success: true,
      data: Array.from(batchMap.values()),
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
    quantity: z.number().min(0),
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
      parsed.notes
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
  rejectBatch,
};
