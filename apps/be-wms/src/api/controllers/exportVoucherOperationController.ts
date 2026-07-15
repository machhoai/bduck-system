import type { NextFunction, Request, Response } from "express";
import {
  completeExport,
  completePicking,
  startPicking,
} from "../../services/exportVoucherService.js";
import {
  savePickingActuals,
  savePickingActualsSchema,
  validatePickingAssignment,
} from "../../services/pickingSessionService.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";
import { assertVoucherAccess } from "../../services/voucherAccessPolicy.js";

export async function savePickingHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const authenticatedUser = requireAuthenticatedRequestUser(req);
    const user = {
      id: authenticatedUser.id,
      roleIds: authenticatedUser.roleIds,
      roleAssignments: authenticatedUser.roleAssignments,
    };

    const parseResult = savePickingActualsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡.",
          zh: "æ•°æ®æ— æ•ˆã€‚",
        },
      });
      return;
    }

    const result = await savePickingActuals(
      req.params.id as string,
      parseResult.data,
      user,
      requireRequestAuthorization(req),
    );
    res.status(200).json({
      success: true,
      data: result,
      messages: {
        vi: `ÄÃ£ lÆ°u sá»‘ liá»‡u soáº¡n hÃ ng (${result.updated} sáº£n pháº©m).`,
        zh: `å·²ä¿å­˜æ‹£è´§æ•°æ®ï¼ˆ${result.updated} ä¸ªäº§å“ï¼‰ã€‚`,
      },
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/export-vouchers/:id/complete-picking
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function completePickingHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const authUser = requireAuthenticatedRequestUser(req);
    const userId = authUser.id;
    const voucherId = req.params.id as string;
    const { db } = await import("../../config/firebase.js");
    const voucherSnap = await db
      .collection("export_vouchers")
      .doc(voucherId)
      .get();
    const voucherData = voucherSnap.data() || {};
    const authorization = requireRequestAuthorization(req);
    assertVoucherAccess(
      authorization,
      "vouchers.write",
      typeof voucherData.warehouse_id === "string"
        ? voucherData.warehouse_id
        : "",
    );

    await validatePickingAssignment(
      typeof voucherData.warehouse_id === "string"
        ? voucherData.warehouse_id
        : null,
      {
        id: userId,
        roleIds: authUser.roleIds,
        roleAssignments: authUser.roleAssignments,
      },
      typeof voucherData.creator_id === "string" ? voucherData.creator_id : "",
    );

    await startPicking(voucherId, authorization);
    await completePicking(voucherId, userId, authorization);

    res.status(200).json({
      success: true,
      data: { voucher_id: voucherId, status: "SHIPPED" },
      messages: {
        vi: "Soáº¡n hÃ ng hoÃ n táº¥t. Tá»“n kho Ä‘Ã£ Ä‘Æ°á»£c trá»«.",
        zh: "æ‹£è´§å®Œæˆã€‚åº“å­˜å·²æ‰£å‡ã€‚",
      },
    });
  } catch (error: any) {
    console.error("[exportVoucherController] Complete picking error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      messages: error.messages || { vi: error.message, zh: error.message },
    });
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/export-vouchers/:id/complete-export
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function completeExportHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId = requireAuthenticatedRequestUser(req).id;
    await completeExport(
      req.params.id as string,
      userId,
      requireRequestAuthorization(req),
    );

    res.status(200).json({
      success: true,
      data: { voucher_id: req.params.id, status: "COMPLETED" },
      messages: {
        vi: "Phiáº¿u xuáº¥t kho Ä‘Ã£ hoÃ n táº¥t.",
        zh: "å‡ºåº“å•å·²å®Œæˆã€‚",
      },
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
