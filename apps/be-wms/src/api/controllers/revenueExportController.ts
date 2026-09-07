import type { Request, Response } from "express";
import { z } from "zod";

import { exportRevenueSchema } from "../../services/revenueExportSchemas.js";
import { exportRevenueWorkbook } from "../../services/revenueExportService.js";
import { resolveRevenueWarehouseId } from "../../services/revenueSourceDashboardService.js";
import { getAuthorizedRevenueWarehouseIds } from "../../services/revenueWarehouseScope.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

export async function exportRevenueHandler(req: Request, res: Response) {
  try {
    const input = exportRevenueSchema.parse(req.body);
    const warehouseId = await resolveRevenueWarehouseId(
      input.source,
      input.warehouseId,
    );
    const warehouseIds = getAuthorizedRevenueWarehouseIds(
      requireRequestAuthorization(req),
      input.source,
      warehouseId,
      "revenue.export",
    );
    const result = await exportRevenueWorkbook(
      { ...input, warehouseId },
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
      warehouseIds,
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
