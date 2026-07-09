import type { Request, Response } from "express";
import { z } from "zod";
import {
  LANDMARK_81_WAREHOUSE_ID,
  getRevenueDashboardData,
  type RevenueDateMode,
} from "../../services/revenueDashboardService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const dashboardQuerySchema = z.object({
  mode: z.enum(["today", "date", "month", "year", "custom"]).default("today"),
  warehouseId: z.string().trim().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function hasPermission(req: Request, action: string, warehouseId: string): boolean {
  const user = (req as Request & {
    user?: { permissions?: Record<string, Record<string, unknown>> };
  }).user;
  if (!user?.permissions) return false;

  const globalPerms = user.permissions.global || {};
  const warehousePerms = user.permissions[warehouseId] || {};
  return (
    globalPerms["*"] === true ||
    globalPerms[action] === true ||
    warehousePerms["*"] === true ||
    warehousePerms[action] === true
  );
}

export const getRevenueDashboardHandler = async (req: Request, res: Response) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const warehouseId = query.warehouseId || LANDMARK_81_WAREHOUSE_ID;

    if (!hasPermission(req, "revenue.read", warehouseId)) {
      return sendError(
        res,
        {
          vi: "Ban khong co quyen xem dashboard doanh thu.",
          zh: "您没有查看营收仪表板的权限。",
        },
        403,
      );
    }

    const user = (req as Request & { user?: { id?: string; uid?: string } }).user;
    const data = await getRevenueDashboardData({
      mode: query.mode as RevenueDateMode,
      warehouseId,
      date: query.date,
      month: query.month,
      year: query.year,
      startDate: query.startDate,
      endDate: query.endDate,
    }, user?.id || user?.uid || "system");

    return sendSuccess(res, data, {
      vi: "Tai du lieu dashboard doanh thu thanh cong.",
      zh: "营收仪表板数据加载成功。",
    });
  } catch (error) {
    console.error("[revenueDashboardController] error:", error);

    if (error instanceof z.ZodError) {
      return sendError(
        res,
        { vi: "Bo loc ngay khong hop le.", zh: "日期筛选条件无效。" },
        400,
        error.flatten(),
      );
    }

    return sendError(
      res,
      {
        vi: "Loi tai du lieu doanh thu tu JoyWorld. Vui long thu lai sau.",
        zh: "从 JoyWorld 加载营收数据失败。请稍后重试。",
      },
      500,
    );
  }
};
