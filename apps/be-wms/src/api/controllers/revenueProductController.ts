import type { Request, Response } from "express";
import { z } from "zod";

import { getRevenueProductGroupCatalog } from "../../services/revenueProductService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

const querySchema = z.object({
  warehouseId: z.string().trim().min(1).max(128),
});

export async function getRevenueProductGroupsHandler(
  req: Request,
  res: Response,
) {
  try {
    const { warehouseId } = querySchema.parse(req.query);
    const groups = await getRevenueProductGroupCatalog(
      requireRequestAuthorization(req),
      warehouseId,
    );
    return sendSuccess(res, groups, {
      vi: "Đã tải nhóm sản phẩm doanh thu.",
      zh: "已加载营收商品分组。",
    });
  } catch (error) {
    console.error("[revenueProductController] error:", error);
    const cause = error as {
      statusCode?: number;
      messages?: { vi: string; zh: string };
    };
    return sendError(
      res,
      cause.messages ?? {
        vi: "Không thể tải nhóm sản phẩm.",
        zh: "无法加载商品分组。",
      },
      error instanceof z.ZodError ? 400 : (cause.statusCode ?? 500),
    );
  }
}
