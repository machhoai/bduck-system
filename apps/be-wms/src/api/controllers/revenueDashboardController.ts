import type { Request, Response } from "express";
import { z } from "zod";
import {
  LANDMARK_81_WAREHOUSE_ID,
  getRevenueDashboardData,
  type RevenueDateMode,
} from "../../services/revenueDashboardService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const dashboardQuerySchema = z.object({
  mode: z.enum(["today", "date", "month", "year", "custom"]).default("today"),
  warehouseId: z.string().trim().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const getRevenueDashboardHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const warehouseId = query.warehouseId || LANDMARK_81_WAREHOUSE_ID;

    requireRequestAuthorization(req).assert("revenue.read", warehouseId);
    const user = requireAuthenticatedRequestUser(req);
    const data = await getRevenueDashboardData(
      {
        mode: query.mode as RevenueDateMode,
        warehouseId,
        date: query.date,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
      },
      user.id,
    );

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

    const apiError = error as {
      statusCode?: number;
      messages?: { vi: string; zh: string };
    };
    return sendError(
      res,
      apiError.messages ?? {
        vi: "Loi tai du lieu doanh thu tu JoyWorld. Vui long thu lai sau.",
        zh: "从 JoyWorld 加载营收数据失败。请稍后重试。",
      },
      apiError.statusCode ?? 500,
    );
  }
};
