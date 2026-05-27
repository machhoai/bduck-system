/**
 * Receiving Session Controller — REST endpoints for saving actuals
 *
 * PUT /api/import-vouchers/:id/actuals
 *
 * ARCHITECTURE:
 * Controller → Service → Repository (layered)
 * Validation via Zod before service call.
 */

import type { Request, Response, NextFunction } from "express";
import {
  saveReceivingActuals,
  saveActualsSchema,
} from "../../services/receivingSessionService.js";

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
    const userId = (req as any).user?.uid || "UNKNOWN";

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

    const result = await saveReceivingActuals(voucherId, parseResult.data, userId);

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
