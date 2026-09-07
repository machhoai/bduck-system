import type { Request, Response } from "express";
import { z } from "zod";

import { LANDMARK_81_WAREHOUSE_ID } from "../../services/revenueDashboardService.js";
import {
  getRevenueSourceDashboardData,
  listAvailableOpenApiWarehouseIds,
  resolveRevenueWarehouseId,
} from "../../services/revenueSourceDashboardService.js";
import { getAuthorizedRevenueWarehouseIds } from "../../services/revenueWarehouseScope.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const dashboardQuerySchema = z.object({
  source: z.enum(["OPEN_API", "LOCAL_POS"]).default("OPEN_API"),
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

export const getOpenApiRevenueWarehousesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const warehouseIds = await listAvailableOpenApiWarehouseIds();
    const authorization = requireRequestAuthorization(req);
    const allowedWarehouseIds = warehouseIds.filter((warehouseId) =>
      authorization.can("revenue.read", warehouseId),
    );
    return sendSuccess(res, allowedWarehouseIds, {
      vi: "Tải danh sách cửa hàng OpenAPI thành công.",
      zh: "OpenAPI 门店列表加载成功。",
    });
  } catch (error) {
    console.error("[revenueDashboardController] openapi warehouses:", error);
    return sendError(
      res,
      {
        vi: "Không thể tải danh sách cửa hàng OpenAPI.",
        zh: "无法加载 OpenAPI 门店列表。",
      },
      500,
    );
  }
};

export const getRevenueDashboardHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const warehouseId = await resolveRevenueWarehouseId(
      query.source,
      query.warehouseId || LANDMARK_81_WAREHOUSE_ID,
    );

    const warehouseIds = getAuthorizedRevenueWarehouseIds(
      requireRequestAuthorization(req),
      query.source,
      warehouseId,
      "revenue.read",
    );
    const user = requireAuthenticatedRequestUser(req);
    const data = await getRevenueSourceDashboardData(
      {
        source: query.source,
        mode: query.mode,
        warehouseId,
        warehouseIds,
        date: query.date,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
      },
      user.id,
    );

    return sendSuccess(res, data, {
      vi: "Tải dữ liệu dashboard doanh thu thành công.",
      zh: "营收仪表板数据加载成功。",
    });
  } catch (error) {
    console.error("[revenueDashboardController] error:", error);

    if (error instanceof z.ZodError) {
      return sendError(
        res,
        { vi: "Bộ lọc ngày không hợp lệ.", zh: "日期筛选条件无效。" },
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
        vi: "Lỗi tải dữ liệu doanh thu. Vui lòng thử lại sau.",
        zh: "从 JoyWorld 加载营收数据失败。请稍后重试。",
      },
      apiError.statusCode ?? 500,
    );
  }
};
