import type { Request, Response } from "express";
import { z } from "zod";
import { getOnlineSalesReport } from "../../services/onlineSalesReportService.js";
import { authorizeOnlineSalesReportRequest } from "../../services/onlineSalesRequestPolicy.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

export const getOnlineSalesReportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const query = authorizeOnlineSalesReportRequest(
      req.query,
      requireRequestAuthorization(req),
    );
    const data = await getOnlineSalesReport({
      warehouseId: query.warehouseId,
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
        {
          vi: "Khoang ngay doanh thu online khong hop le.",
          zh: "线上营收日期范围无效。",
        },
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
        vi: "Loi tai du lieu doanh thu online. Vui long thu lai sau.",
        zh: "加载线上营收数据失败，请稍后重试。",
      },
      apiError.statusCode ?? 500,
    );
  }
};
