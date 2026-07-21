import type { Request, Response } from "express";
import { z } from "zod";
import { fetchInventoryDashboardSummary } from "../../services/dashboardService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

const dashboardQuerySchema = z.object({
  warehouse_id: z.string().trim().min(1).optional(),
});

export const getInventoryDashboardSummary = async (
  req: Request,
  res: Response,
) => {
  const startedAt = performance.now();
  try {
    const { warehouse_id: warehouseId } = dashboardQuerySchema.parse(req.query);
    const summary = await fetchInventoryDashboardSummary(
      requireRequestAuthorization(req),
      warehouseId,
    );
    // The service has an actor-scoped in-memory cache; never persist a user's
    // dashboard response in a shared browser cache across account switches.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Server-Timing",
      `dashboard;dur=${Math.round(performance.now() - startedAt)}`,
    );
    return sendSuccess(res, summary, {
      vi: "Tải tổng quan dashboard thành công.",
      zh: "仪表板概览加载成功。",
    });
  } catch (error) {
    console.error("[dashboardController] error:", error);
    if (error instanceof z.ZodError) {
      return sendError(
        res,
        { vi: "Bộ lọc dashboard không hợp lệ.", zh: "仪表板筛选条件无效。" },
        400,
        error.flatten(),
      );
    }
    const apiError = error as {
      statusCode?: number;
      messages?: { vi: string; zh: string };
    };
    return sendError(
      res,
      apiError.messages ?? {
        vi: "Không thể tải tổng quan dashboard.",
        zh: "无法加载仪表板概览。",
      },
      apiError.statusCode ?? 500,
    );
  }
};
