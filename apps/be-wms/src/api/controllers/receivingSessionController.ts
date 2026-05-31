/**
 * Receiving Session Controller — REST endpoints for saving actuals
 *
 * PUT  /api/import-vouchers/:id/actuals            — Save actual_quantity data
 * POST /api/import-vouchers/:id/complete-receiving  — Finalize receiving session
 *
 * ARCHITECTURE:
 * Controller → Service → Repository (layered)
 * Validation via Zod before service call.
 */

import type { Request, Response, NextFunction } from "express";
import {
  saveReceivingActuals,
  saveActualsSchema,
  validateStepAssignment,
} from "../../services/receivingSessionService.js";
import {
  startReceiving,
  completeReceiving,
} from "../../services/importVoucherService.js";
import { sendSuccess, sendError } from "../../utils/responseHelper.js";

/**
 * PUT /api/import-vouchers/:id/actuals
 * Saves actual_quantity data from the Receiving Session UI.
 */
export async function saveActuals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const voucherId = req.params.id as string;
    const user = {
      id: (req as any).user?.id || (req as any).user?.uid || "UNKNOWN",
      roleIds: (req as any).user?.roleIds || [],
    };

    // Validate input (Zod — LUẬT THÉP)
    const parseResult = saveActualsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Dữ liệu không hợp lệ: " + parseResult.error.issues.map((i: { message: string }) => i.message).join(", "),
          zh: "数据无效: " + parseResult.error.issues.map((i: { message: string }) => i.message).join(", "),
        },
        errors: parseResult.error.issues,
      });
      return;
    }

    // Service handles assignment validation + data persistence
    const result = await saveReceivingActuals(voucherId, parseResult.data, user);

    res.status(200).json({
      success: true,
      data: result,
      messages: {
        vi: `Đã lưu số liệu thực nhận (${result.updated} sản phẩm).`,
        zh: `已保存实际数量（${result.updated} 个产品）。`,
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        data: null,
        messages: error.messages || {
          vi: error.message,
          zh: error.message,
        },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/import-vouchers/:id/complete-receiving
 * Finalizes the receiving session: APPROVED → RECEIVING → COMPLETED.
 * Triggers ATP inventory update.
 */
export async function completeReceivingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const voucherId = req.params.id as string;
    const user = {
      id: (req as any).user?.id || (req as any).user?.uid || "UNKNOWN",
      roleIds: (req as any).user?.roleIds || [],
    };

    // Validate step assignment in service layer
    // (reads voucher to get creator_id + warehouse_id, then checks config)
    const { db } = await import("../../config/firebase.js");
    const voucherSnap = await db.collection("import_vouchers").doc(voucherId).get();
    const voucherData = voucherSnap.data() || {};
    await validateStepAssignment(
      "IMPORT_VOUCHER",
      typeof voucherData.warehouse_id === "string" ? voucherData.warehouse_id : null,
      "receiving",
      user,
      typeof voucherData.creator_id === "string" ? voucherData.creator_id : "",
    );

    // 1. Advance to RECEIVING
    await startReceiving(voucherId);

    // 2. Update ATP inventory and advance to COMPLETED
    await completeReceiving(voucherId, user.id);

    sendSuccess(res, { voucher_id: voucherId, status: "COMPLETED" }, {
      vi: "Phiên kiểm đếm đã hoàn tất. Tồn kho đã được cập nhật.",
      zh: "盘点会话已完成。库存已更新。",
    });
  } catch (error: any) {
    console.error("[receivingSessionController] Complete receiving error:", error);
    if (error.statusCode) {
      sendError(
        res,
        error.messages || {
          vi: error.message,
          zh: error.message,
        },
        error.statusCode,
      );
      return;
    }
    next(error);
  }
}
