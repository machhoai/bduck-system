import type {
  RevenueDashboardData,
  RevenueExportReportType,
  RevenueExportRequest,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

import { applyRevenueProductSelection } from "./revenueExportSelection.js";
import { addRevenueInvoiceSheet } from "./revenueInvoiceWorkbook.js";
import { REVENUE_WORKBOOK_COPY } from "./revenueWorkbookCopy.js";
import {
  addRevenueCompositionSheets,
  addRevenueDailySheet,
  addRevenuePaymentSheet,
  addRevenueSummarySheet,
} from "./revenueWorkbookSheets.js";

export async function buildRevenueWorkbook(
  dashboard: RevenueDashboardData,
  reportType: RevenueExportReportType,
  locale: "vi" | "zh",
  options: Pick<RevenueExportRequest, "products" | "roundMoney"> = {},
): Promise<Buffer> {
  if (
    reportType === "INVOICE_PREPARATION" &&
    dashboard.source !== "LOCAL_POS"
  ) {
    throw new Error("Invoice preparation requires LOCAL_POS");
  }
  const selected =
    reportType === "DAILY_REVENUE"
      ? dashboard
      : applyRevenueProductSelection(dashboard, options.products);
  const copy = REVENUE_WORKBOOK_COPY[locale];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "B.Duck System";
  workbook.company = "B.Duck";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.subject =
    reportType === "DAILY_REVENUE"
      ? copy.revenueTitle
      : reportType === "SALES_COMPOSITION"
        ? copy.salesTitle
        : copy.invoiceTitle;

  addRevenueSummarySheet(
    workbook,
    selected,
    reportType,
    copy,
    options.roundMoney,
  );
  if (reportType === "DAILY_REVENUE") {
    addRevenueDailySheet(workbook, dashboard, copy);
    addRevenuePaymentSheet(workbook, dashboard, copy);
  } else if (reportType === "SALES_COMPOSITION") {
    addRevenueCompositionSheets(workbook, selected, copy);
  } else {
    addRevenueInvoiceSheet(workbook, selected, locale, options.roundMoney);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
