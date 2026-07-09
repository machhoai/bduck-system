/**
 * Revenue Sync Controller
 *
 * Handles HTTP requests for triggering revenue sync from JoyWorld API.
 * Protected by requireAuth middleware.
 */

import type { Request, Response } from "express";
import {
  syncRevenueForPeriod,
  getCachedRevenue,
} from "../../services/revenueSyncService.js";
import {
  getJoyworldToken,
  getOrderDetail,
} from "../../services/joyworldService.js";

/**
 * GET /api/revenue/sync/:period
 *
 * Triggers a revenue sync for the given period (YYYY-MM).
 * If Firestore data is fresh (<5 min), returns cached data without re-fetching.
 */
export async function syncRevenueHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const period = String(req.params.period || "");
    const warehouseId = String(req.query.warehouseId || "");

    // Validate period format
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Kỳ kế toán không hợp lệ. Định dạng: YYYY-MM",
          zh: "会计期间格式无效。格式：YYYY-MM",
        },
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (req as any).user as { id: string } | undefined;
    const userId = user?.id || "system";

    const result = await syncRevenueForPeriod(period, userId, warehouseId || undefined);

    // Convert Firestore Timestamp to ISO string for JSON response
    const syncTimeValue = result.data.sync_time;
    const syncTimeDate =
      syncTimeValue && typeof (syncTimeValue as any).toDate === "function"
        ? (syncTimeValue as any).toDate()
        : syncTimeValue;

    res.json({
      success: true,
      data: {
        ...result.data,
        sync_time: syncTimeDate ?? null,
        was_refreshed: result.synced,
      },
      messages: {
        vi: result.synced
          ? "Đã đồng bộ doanh thu từ hệ thống chính."
          : "Dữ liệu doanh thu vẫn còn mới, không cần đồng bộ lại.",
        zh: result.synced
          ? "已从主系统同步营收数据。"
          : "营收数据仍然是最新的，无需重新同步。",
      },
    });
  } catch (error) {
    console.error("[revenueSyncController] sync error:", error);
    res.status(500).json({
      success: false,
      data: null,
      messages: {
        vi: "Lỗi đồng bộ doanh thu. Vui lòng thử lại sau.",
        zh: "同步营收数据时出错。请稍后重试。",
      },
    });
  }
}

/**
 * GET /api/revenue/cached/:period
 *
 * Returns cached revenue data without triggering sync.
 */
export async function getCachedRevenueHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const period = String(req.params.period || "");
    const warehouseId = String(req.query.warehouseId || "");

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Kỳ kế toán không hợp lệ.",
          zh: "会计期间格式无效。",
        },
      });
      return;
    }

    const data = await getCachedRevenue(period, warehouseId || undefined);

    // Convert Firestore Timestamp to ISO string for JSON response
    let responseData = null;
    if (data) {
      const syncTimeValue = data.sync_time;
      const syncTimeDate =
        syncTimeValue && typeof (syncTimeValue as any).toDate === "function"
          ? (syncTimeValue as any).toDate()
          : syncTimeValue;
      responseData = { ...data, sync_time: syncTimeDate ?? null };
    }

    res.json({
      success: true,
      data: responseData,
      messages: {
        vi: data
          ? "Dữ liệu doanh thu đã được tải."
          : "Chưa có dữ liệu doanh thu cho kỳ này.",
        zh: data
          ? "营收数据已加载。"
          : "该期间尚无营收数据。",
      },
    });
  } catch (error) {
    console.error("[revenueSyncController] cached error:", error);
    res.status(500).json({
      success: false,
      data: null,
      messages: {
        vi: "Lỗi tải dữ liệu doanh thu.",
        zh: "加载营收数据时出错。",
      },
    });
  }
}

/**
 * GET /api/revenue/order-details/:orderId
 *
 * Proxy to fetch order details from JoyWorld
 */
export async function getOrderDetailsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const orderId = String(req.params.orderId || "");
    if (!orderId) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Thiếu mã đơn hàng.",
          zh: "缺少订单号。",
        },
      });
      return;
    }
    
    const token = await getJoyworldToken();
    const response = await getOrderDetail(token, orderId);

    res.json({
      success: true,
      data: response.data || response,
      messages: {
        vi: "Tải chi tiết đơn hàng thành công.",
        zh: "成功加载订单详情。",
      },
    });
  } catch (error) {
    console.error("[revenueSyncController] getOrderDetailsHandler error:", error);
    res.status(500).json({
      success: false,
      data: null,
      messages: {
        vi: "Lỗi tải chi tiết đơn hàng.",
        zh: "加载订单详情时出错。",
      },
    });
  }
}
