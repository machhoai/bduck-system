/**
 * Export Voucher Controller â€” Thin REST endpoint handlers
 *
 * Delegates ALL business logic to services.
 * Controller only handles: request parsing â†’ service call â†’ response formatting.
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
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/export-vouchers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId = requireAuthenticatedRequestUser(req).id;
    const parseResult = createExportVoucherSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi:
            "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
          zh:
            "æ•°æ®æ— æ•ˆ: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
        },
      });
      return;
    }

    const voucher = await createExportVoucher(
      parseResult.data,
      userId,
      requireRequestAuthorization(req),
    );

    res.status(201).json({
      success: true,
      data: voucher,
      messages: {
        vi: "ÄÃ£ táº¡o phiáº¿u xuáº¥t kho thÃ nh cÃ´ng.",
        zh: "å‡ºåº“å•åˆ›å»ºæˆåŠŸã€‚",
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

export async function updateHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const userId = requireAuthenticatedRequestUser(req).id;
    const parseResult = updateExportVoucherSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi:
            "Du lieu khong hop le: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
          zh:
            "æ•°æ®æ— æ•ˆ: " +
            parseResult.error.issues.map((i) => i.message).join(", "),
        },
      });
      return;
    }

    const voucher = await updateExportVoucher(
      req.params.id as string,
      parseResult.data,
      userId,
      requireRequestAuthorization(req),
    );
    res.status(200).json({
      success: true,
      data: voucher,
      messages: {
        vi: "Phieu xuat kho da duoc cap nhat thanh cong.",
        zh: "å‡ºåº“å•å·²æˆåŠŸæ›´æ–°ã€‚",
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
// GET /api/export-vouchers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getActiveHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const vouchers = await fetchActiveVouchers(
      requireRequestAuthorization(req),
    );
    res.status(200).json({
      success: true,
      data: vouchers,
      messages: { vi: "OK", zh: "OK" },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      messages: { vi: error.message, zh: error.message },
    });
  }
}

export async function getCompletedHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const vouchers = await fetchCompletedVouchers(
      requireRequestAuthorization(req),
    );
    res.status(200).json({
      success: true,
      data: vouchers,
      messages: { vi: "OK", zh: "OK" },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      messages: { vi: error.message, zh: error.message },
    });
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/export-vouchers/:id
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getByIdHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const result = await fetchVoucherWithItems(
      req.params.id as string,
      requireRequestAuthorization(req),
    );
    if (!result) {
      res.status(404).json({
        success: false,
        data: null,
        messages: { vi: "KhÃ´ng tÃ¬m tháº¥y phiáº¿u.", zh: "æœªæ‰¾åˆ°å•æ®ã€‚" },
      });
      return;
    }
    res
      .status(200)
      .json({ success: true, data: result, messages: { vi: "OK", zh: "OK" } });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      messages: { vi: error.message, zh: error.message },
    });
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PUT /api/export-vouchers/:id/picking-actuals
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export {
  completeExportHandler,
  completePickingHandler,
  savePickingHandler,
} from "./exportVoucherOperationController.js";
