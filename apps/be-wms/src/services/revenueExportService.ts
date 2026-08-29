import { randomUUID } from "node:crypto";

import {
  AuditAction,
  type RevenueExportRequest,
} from "@bduck/shared-types";

import { logAudit, type AuditMetadata } from "./auditService.js";
import {
  assertRevenueExportRange,
  normalizeRevenueRange,
} from "./revenueDateRange.js";
import { getRevenueSourceDashboardData } from "./revenueSourceDashboardService.js";
import { buildRevenueWorkbook } from "./revenueWorkbookService.js";

export async function exportRevenueWorkbook(
  input: RevenueExportRequest,
  userId: string,
  auditMetadata?: AuditMetadata,
) {
  const range = normalizeRevenueRange(input);
  assertRevenueExportRange(range);
  const dashboard = await getRevenueSourceDashboardData(
    {
      source: input.source,
      warehouseId: input.warehouseId,
      mode: input.mode,
      date: input.date,
      month: input.month,
      year: input.year,
      startDate: input.startDate,
      endDate: input.endDate,
    },
    userId,
  );
  const buffer = await buildRevenueWorkbook(
    dashboard,
    input.reportType,
    input.locale,
  );
  const exportId = randomUUID();
  const reportName =
    input.reportType === "DAILY_REVENUE"
      ? "daily-revenue"
      : "sales-composition";
  const fileName = [
    reportName,
    input.source.toLowerCase().replace("_", "-"),
    range.startDate,
    range.endDate,
  ].join("_") + ".xlsx";

  await logAudit({
    entity_type: "REVENUE_EXPORT",
    entity_id: exportId,
    warehouse_id: dashboard.warehouseId,
    action: AuditAction.EXPORT,
    user_id: userId,
    old_value: null,
    new_value: {
      id: exportId,
      source: input.source,
      report_type: input.reportType,
      locale: input.locale,
      start_date: range.startDate,
      end_date: range.endDate,
      output_file_name: fileName,
      daily_row_count: dashboard.dailyRows.length,
      product_group_count: dashboard.topProductGroups.length,
    },
    ...auditMetadata,
    action_time: new Date(input.actionTime),
    notes: "Export revenue workbook",
  });

  return { buffer, fileName, exportId };
}
