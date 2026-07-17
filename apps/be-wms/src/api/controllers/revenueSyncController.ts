import type { Request, Response } from "express";
import { z } from "zod";
import {
  getJoyworldToken,
  getOrderDetail,
} from "../../services/joyworldService.js";
import { LANDMARK_81_WAREHOUSE_ID } from "../../services/revenueDashboardService.js";
import {
  getCachedRevenue,
  syncRevenueForPeriod,
} from "../../services/revenueSyncService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const periodSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const warehouseQuerySchema = z.object({
  warehouseId: z.string().uuid().default(LANDMARK_81_WAREHOUSE_ID),
});
const orderIdSchema = z.string().trim().min(1).max(128);

const serializeRevenue = <T extends { sync_time: unknown }>(data: T) => {
  const syncTime = data.sync_time as { toDate?: () => Date } | null;
  return {
    ...data,
    sync_time: syncTime?.toDate ? syncTime.toDate() : (syncTime ?? null),
  };
};

const handleRevenueError = (res: Response, error: unknown): void => {
  console.error("[revenueSyncController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi xử lý dữ liệu doanh thu.",
      zh: "处理营收数据时出错。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
    error instanceof z.ZodError ? error.flatten() : undefined,
  );
};

export const syncRevenueHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const period = periodSchema.parse(req.params.period);
    const { warehouseId } = warehouseQuerySchema.parse(req.query);
    const authorization = requireRequestAuthorization(req);
    authorization.assert("revenue.sync", warehouseId);
    const result = await syncRevenueForPeriod(
      period,
      requireAuthenticatedRequestUser(req).id,
      warehouseId,
    );
    sendSuccess(
      res,
      {
        ...serializeRevenue(result.data),
        was_refreshed: result.synced,
      },
      {
        vi: result.synced
          ? "Đã đồng bộ doanh thu từ hệ thống chính."
          : "Dữ liệu doanh thu vẫn còn mới.",
        zh: result.synced
          ? "已从主系统同步营收数据。"
          : "营收数据仍然是最新的。",
      },
    );
  } catch (error) {
    handleRevenueError(res, error);
  }
};

export const getCachedRevenueHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const period = periodSchema.parse(req.params.period);
    const { warehouseId } = warehouseQuerySchema.parse(req.query);
    requireRequestAuthorization(req).assert("revenue.read", warehouseId);
    const data = await getCachedRevenue(period, warehouseId);
    sendSuccess(res, data ? serializeRevenue(data) : null, {
      vi: data
        ? "Dữ liệu doanh thu đã được tải."
        : "Chưa có dữ liệu doanh thu cho kỳ này.",
      zh: data ? "营收数据已加载。" : "该期间尚无营收数据。",
    });
  } catch (error) {
    handleRevenueError(res, error);
  }
};

export const getOrderDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const orderId = orderIdSchema.parse(req.params.orderId);
    const { warehouseId } = warehouseQuerySchema.parse(req.query);
    requireRequestAuthorization(req).assert("revenue.read", warehouseId);
    const response = await getOrderDetail(await getJoyworldToken(), orderId);
    sendSuccess(res, response.data || response, {
      vi: "Tải chi tiết đơn hàng thành công.",
      zh: "成功加载订单详情。",
    });
  } catch (error) {
    handleRevenueError(res, error);
  }
};
