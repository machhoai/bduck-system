import type { Request, Response } from "express";
import { z } from "zod";

import { exportRevenueWorkbook } from "../../services/revenueExportService.js";
import { resolveRevenueWarehouseId } from "../../services/revenueSourceDashboardService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const exportRevenueSchema = z.object({
  source: z.enum(["OPEN_API", "LOCAL_POS"]),
  reportType: z.enum(["DAILY_REVENUE", "SALES_COMPOSITION"]),
  warehouseId: z.string().trim().min(1).max(128),
  locale: z.enum(["vi", "zh"]),
  actionTime: z.string().datetime({ offset: true }),
  mode: z.enum(["today", "date", "month", "year", "custom"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  month: z.string().regex(/^\d{4}-\d{2}$/u),
  year: z.string().regex(/^\d{4}$/u),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
});

export async function exportRevenueHandler(req: Request, res: Response) {
  try {
    const input = exportRevenueSchema.parse(req.body);
    const warehouseId = await resolveRevenueWarehouseId(
      input.source,
      input.warehouseId,
    );
    requireRequestAuthorization(req).assert("revenue.export", warehouseId);
    const result = await exportRevenueWorkbook(
      { ...input, warehouseId },
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader("X-Revenue-Export-Id", result.exportId);
    return res.send(result.buffer);
  } catch (error) {
    console.error("[revenueExportController] error:", error);
    if (error instanceof z.ZodError) {
      return sendError(
        res,
        { vi: "Yêu cầu xuất dữ liệu không hợp lệ.", zh: "导出请求无效。" },
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
        vi: "Không thể xuất báo cáo doanh thu.",
        zh: "无法导出营收报表。",
      },
      apiError.statusCode ?? 500,
    );
  }
}
