import type { Request, Response } from "express";
import { z } from "zod";
import { LANDMARK_81_WAREHOUSE_ID } from "../../services/revenueDashboardService.js";
import { getOnlineSalesReport } from "../../services/onlineSalesReportService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const onlineSalesReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function hasPermission(req: Request, action: string): boolean {
  const user = (req as Request & {
    user?: { permissions?: Record<string, Record<string, unknown>> };
  }).user;
  if (!user?.permissions) return false;

  const globalPerms = user.permissions.global || {};
  const warehousePerms = user.permissions[LANDMARK_81_WAREHOUSE_ID] || {};
  return (
    globalPerms["*"] === true ||
    globalPerms[action] === true ||
    warehousePerms["*"] === true ||
    warehousePerms[action] === true
  );
}

export const getOnlineSalesReportHandler = async (req: Request, res: Response) => {
  try {
    if (!hasPermission(req, "revenue.read")) {
      return sendError(
        res,
        {
          vi: "Ban khong co quyen xem doanh thu online.",
          zh: "您没有查看线上营收的权限。",
        },
        403,
      );
    }

    const query = onlineSalesReportQuerySchema.parse(req.query);
    const data = await getOnlineSalesReport({
      from: query.from,
      to: query.to,
    });

    return sendSuccess(res, data, {
      vi: "Tai du lieu doanh thu online thanh cong.",
      zh: "线上营收数据加载成功。",
    });
  } catch (error) {
    console.error("[onlineSalesReportController] error:", error);

    if (error instanceof z.ZodError) {
      return sendError(
        res,
        { vi: "Khoang ngay doanh thu online khong hop le.", zh: "线上营收日期范围无效。" },
        400,
        error.flatten(),
      );
    }

    return sendError(
      res,
      {
        vi: "Loi tai du lieu doanh thu online. Vui long thu lai sau.",
        zh: "加载线上营收数据失败，请稍后重试。",
      },
      500,
    );
  }
};
