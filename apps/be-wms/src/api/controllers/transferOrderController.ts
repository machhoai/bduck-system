/**
 * Transfer Order Controller — Thin REST endpoint handlers
 *
 * Delegates ALL business logic to services.
 * Controller only handles: request parsing → service call → response formatting.
 */

import type { Request, Response, NextFunction } from "express";
import {
  createTransferOrder,
  createTransferOrderSchema,
  createExportFromTransfer,
  receiveTransfer,
  completeReceiving,
  completeReceivingSchema,
} from "../../services/transferOrderService.js";
import {
  listTransferOrders,
  getTransferOrderById,
} from "../../services/transferQueryService.js";

// ─────────────────────────────────────────────
// POST /api/transfer-orders
// ─────────────────────────────────────────────

export async function createHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId =
      (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    const parseResult = createTransferOrderSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi:
            "Dữ liệu không hợp lệ: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
          zh:
            "数据无效: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
        },
      });
      return;
    }

    const order = await createTransferOrder(parseResult.data, userId);

    res.status(201).json({
      success: true,
      data: order,
      messages: {
        vi: "Đã tạo phiếu điều chuyển thành công.",
        zh: "调拨单创建成功。",
      },
    });
  } catch (error: any) {
    console.error("[transferOrderController] Create error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// GET /api/transfer-orders
// ─────────────────────────────────────────────

export async function listHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const filters = {
      source_warehouse_id: req.query.source_warehouse_id as string | undefined,
      destination_warehouse_id: req.query.destination_warehouse_id as
        | string
        | undefined,
      transfer_type: req.query.transfer_type as string | undefined,
      status: req.query.status as string | undefined,
    };

    const orders = await listTransferOrders(filters);
    res.status(200).json({
      success: true,
      data: orders,
      messages: { vi: "OK", zh: "OK" },
    });
  } catch (error: any) {
    console.error("[transferOrderController] List error:", error);
    res.status(500).json({
      success: false,
      data: null,
      messages: { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// GET /api/transfer-orders/:id
// ─────────────────────────────────────────────

export async function getDetailHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const detail = await getTransferOrderById(req.params.id as string);
    if (!detail) {
      res.status(404).json({
        success: false,
        data: null,
        messages: {
          vi: "Không tìm thấy phiếu điều chuyển.",
          zh: "找不到调拨单。",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: detail,
      messages: { vi: "OK", zh: "OK" },
    });
  } catch (error: any) {
    console.error("[transferOrderController] Detail error:", error);
    res.status(500).json({
      success: false,
      data: null,
      messages: { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// POST /api/transfer-orders/:id/create-export
// ─────────────────────────────────────────────

export async function createExportHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId =
      (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    const orderId = req.params.id as string;
    const additionalAttachments = req.body.additional_attachment_urls ?? [];

    const exportVoucher = await createExportFromTransfer(
      orderId,
      userId,
      additionalAttachments,
    );

    res.status(201).json({
      success: true,
      data: exportVoucher,
      messages: {
        vi: "Đã tạo lệnh xuất kho từ phiếu điều chuyển.",
        zh: "已从调拨单创建出库单。",
      },
    });
  } catch (error: any) {
    console.error("[transferOrderController] CreateExport error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// POST /api/transfer-orders/:id/receive
// ─────────────────────────────────────────────

export async function receiveHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId =
      (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    const orderId = req.params.id as string;

    await receiveTransfer(orderId, userId);

    res.status(200).json({
      success: true,
      data: null,
      messages: {
        vi: "Đã bắt đầu nhận hàng.",
        zh: "已开始接收货物。",
      },
    });
  } catch (error: any) {
    console.error("[transferOrderController] Receive error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// POST /api/transfer-orders/:id/complete-receiving
// ─────────────────────────────────────────────

export async function completeReceivingHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId =
      (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    const orderId = req.params.id as string;

    const parseResult = completeReceivingSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi:
            "Dữ liệu không hợp lệ: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
          zh:
            "数据无效: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
        },
      });
      return;
    }

    await completeReceiving(orderId, parseResult.data, userId);

    res.status(200).json({
      success: true,
      data: null,
      messages: {
        vi: "Đã hoàn tất kiểm đếm và nhận hàng thành công.",
        zh: "已完成盘点和接收。",
      },
    });
  } catch (error: any) {
    console.error("[transferOrderController] CompleteReceiving error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}
