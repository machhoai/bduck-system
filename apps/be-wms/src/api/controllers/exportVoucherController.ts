/**
 * Export Voucher Controller — Thin REST endpoint handlers
 *
 * Delegates ALL business logic to services.
 * Controller only handles: request parsing → service call → response formatting.
 */

import type { Request, Response, NextFunction } from "express";
import {
  createExportVoucher,
  createExportVoucherSchema,
  updateExportVoucher,
  updateExportVoucherSchema,
  startPicking,
  completePicking,
  completeExport,
} from "../../services/exportVoucherService.js";
import {
  savePickingActuals,
  savePickingActualsSchema,
  validatePickingAssignment,
} from "../../services/pickingSessionService.js";
import {
  fetchActiveVouchers,
  fetchCompletedVouchers,
  fetchVoucherWithItems,
} from "../../services/exportVoucherQueryService.js";

// ─────────────────────────────────────────────
// POST /api/export-vouchers
// ─────────────────────────────────────────────

export async function createHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    const parseResult = createExportVoucherSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Dữ liệu không hợp lệ: " + parseResult.error.issues.map((i) => i.message).join(", "),
          zh: "数据无效: " + parseResult.error.issues.map((i) => i.message).join(", "),
        },
      });
      return;
    }

    const voucher = await createExportVoucher(parseResult.data, userId);

    res.status(201).json({
      success: true,
      data: voucher,
      messages: { vi: "Đã tạo phiếu xuất kho thành công.", zh: "出库单创建成功。" },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

export async function updateHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    const parseResult = updateExportVoucherSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Du lieu khong hop le: " + parseResult.error.issues.map((i) => i.message).join(", "),
          zh: "数据无效: " + parseResult.error.issues.map((i) => i.message).join(", "),
        },
      });
      return;
    }

    const voucher = await updateExportVoucher(req.params.id as string, parseResult.data, userId);
    res.status(200).json({
      success: true,
      data: voucher,
      messages: { vi: "Phieu xuat kho da duoc cap nhat thanh cong.", zh: "出库单已成功更新。" },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// GET /api/export-vouchers
// ─────────────────────────────────────────────

export async function getActiveHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const vouchers = await fetchActiveVouchers();
    res.status(200).json({ success: true, data: vouchers, messages: { vi: "OK", zh: "OK" } });
  } catch (error: any) {
    res.status(500).json({ success: false, data: null, messages: { vi: error.message, zh: error.message } });
  }
}

export async function getCompletedHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const vouchers = await fetchCompletedVouchers();
    res.status(200).json({ success: true, data: vouchers, messages: { vi: "OK", zh: "OK" } });
  } catch (error: any) {
    res.status(500).json({ success: false, data: null, messages: { vi: error.message, zh: error.message } });
  }
}

// ─────────────────────────────────────────────
// GET /api/export-vouchers/:id
// ─────────────────────────────────────────────

export async function getByIdHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const result = await fetchVoucherWithItems(req.params.id as string);
    if (!result) {
      res.status(404).json({
        success: false, data: null,
        messages: { vi: "Không tìm thấy phiếu.", zh: "未找到单据。" },
      });
      return;
    }
    res.status(200).json({ success: true, data: result, messages: { vi: "OK", zh: "OK" } });
  } catch (error: any) {
    res.status(500).json({ success: false, data: null, messages: { vi: error.message, zh: error.message } });
  }
}

// ─────────────────────────────────────────────
// PUT /api/export-vouchers/:id/picking-actuals
// ─────────────────────────────────────────────

export async function savePickingHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const user = {
      id: (req as any).user?.id || (req as any).user?.uid || "UNKNOWN",
      roleIds: (req as any).user?.roleIds || [],
      roleAssignments: (req as any).user?.roleAssignments || [],
    };

    const parseResult = savePickingActualsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false, data: null,
        messages: { vi: "Dữ liệu không hợp lệ.", zh: "数据无效。" },
      });
      return;
    }

    const result = await savePickingActuals(req.params.id as string, parseResult.data, user);
    res.status(200).json({
      success: true, data: result,
      messages: {
        vi: `Đã lưu số liệu soạn hàng (${result.updated} sản phẩm).`,
        zh: `已保存拣货数据（${result.updated} 个产品）。`,
      },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false, data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// POST /api/export-vouchers/:id/complete-picking
// ─────────────────────────────────────────────

export async function completePickingHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const authUser = (req as any).user;
    const userId = authUser?.id || authUser?.uid || "UNKNOWN";
    const voucherId = req.params.id as string;
    const { db } = await import("../../config/firebase.js");
    const voucherSnap = await db.collection("export_vouchers").doc(voucherId).get();
    const voucherData = voucherSnap.data() || {};

    await validatePickingAssignment(
      typeof voucherData.warehouse_id === "string" ? voucherData.warehouse_id : null,
      {
        id: userId,
        roleIds: authUser?.roleIds || [],
        roleAssignments: authUser?.roleAssignments || [],
      },
      typeof voucherData.creator_id === "string" ? voucherData.creator_id : "",
    );

    await startPicking(voucherId);
    await completePicking(voucherId, userId);

    res.status(200).json({
      success: true,
      data: { voucher_id: voucherId, status: "SHIPPED" },
      messages: { vi: "Soạn hàng hoàn tất. Tồn kho đã được trừ.", zh: "拣货完成。库存已扣减。" },
    });
  } catch (error: any) {
    console.error("[exportVoucherController] Complete picking error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false, data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// ─────────────────────────────────────────────
// POST /api/export-vouchers/:id/complete-export
// ─────────────────────────────────────────────

export async function completeExportHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid || "UNKNOWN";
    await completeExport(req.params.id as string, userId);

    res.status(200).json({
      success: true,
      data: { voucher_id: req.params.id, status: "COMPLETED" },
      messages: { vi: "Phiếu xuất kho đã hoàn tất.", zh: "出库单已完成。" },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false, data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}
