import type {
  RevenueDashboardData,
  RevenueExportReportType,
} from "@bduck/shared-types";
import type ExcelJS from "exceljs";

import type { RevenueWorkbookCopy } from "./revenueWorkbookCopy.js";
import {
  MONEY_FORMAT,
  NUMBER_FORMAT,
  addTotalRow,
  excelDate,
  finishTable,
  prepareTableSheet,
  sheetOptions,
  styleMetadataLabel,
  styleMetadataValue,
  styleMetricLabel,
  styleMetricValue,
  title,
} from "./revenueWorkbookFormatting.js";

export function addRevenueSummarySheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  reportType: RevenueExportReportType,
  copy: RevenueWorkbookCopy,
  roundMoney = false,
) {
  const sheet = workbook.addWorksheet(copy.summary, sheetOptions(1));
  sheet.columns = [{ width: 34 }, { width: 28 }, { width: 34 }, { width: 28 }];
  title(
    sheet,
    reportType === "DAILY_REVENUE"
      ? copy.revenueTitle
      : reportType === "SALES_COMPOSITION"
        ? copy.salesTitle
        : copy.invoiceTitle,
    4,
  );
  const source = data.source === "OPEN_API" ? copy.openApi : copy.localPos;
  [
    [
      copy.store,
      data.warehouseName,
      copy.range,
      `${data.range.startDate} – ${data.range.endDate}`,
    ],
    [copy.source, source, "", ""],
    [copy.generated, new Date(data.generatedAt), "", ""],
  ].forEach((values, index) => {
    const row = sheet.getRow(index + 3);
    row.values = values;
    row.height = 24;
    [1, 3].forEach((column) => styleMetadataLabel(row.getCell(column)));
    [2, 4].forEach((column) => styleMetadataValue(row.getCell(column)));
  });
  sheet.getCell("B5").numFmt = "dd/mm/yyyy hh:mm";
  const metrics =
    reportType !== "DAILY_REVENUE"
      ? [
          [
            copy.totalRevenue,
            reportType === "INVOICE_PREPARATION"
              ? data.soldItems.reduce(
                  (sum, item) =>
                    sum +
                    (roundMoney ? Math.round(item.realMoney) : item.realMoney),
                  0,
                )
              : data.topProductGroups.reduce(
                  (sum, group) => sum + group.revenue,
                  0,
                ),
            copy.selectedQuantity,
            data.topProductGroups.reduce(
              (sum, group) => sum + group.quantity,
              0,
            ),
          ],
          [copy.selectedGroups, data.topProductGroups.length, "", ""],
        ]
      : [
          [
            copy.totalRevenue,
            data.stats.totalRevenue.value,
            copy.totalOrders,
            data.stats.totalOrders.value,
          ],
          [
            copy.cashRevenue,
            data.stats.cashRevenue.value,
            copy.averageOrder,
            data.stats.averageOrderValue.value,
          ],
          [copy.transferRevenue, data.stats.transferRevenue.value, "", ""],
          [copy.otherRevenue, data.stats.otherRevenue.value, "", ""],
        ];
  metrics.forEach((values, index) => {
    const row = sheet.getRow(index + 8);
    row.values = values;
    row.height = 30;
    [1, 3].forEach((column) => styleMetricLabel(row.getCell(column)));
    [2, 4].forEach((column) => styleMetricValue(row.getCell(column)));
  });
  ["B8", "B9", "D9", "B10", "B11"].forEach(
    (address) => (sheet.getCell(address).numFmt = MONEY_FORMAT),
  );
  sheet.getCell("D8").numFmt = NUMBER_FORMAT;
  if (reportType !== "DAILY_REVENUE")
    sheet.getCell("B9").numFmt = NUMBER_FORMAT;
}

export function addRevenueDailySheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  copy: RevenueWorkbookCopy,
) {
  const sheet = workbook.addWorksheet(copy.daily, sheetOptions(2));
  prepareTableSheet(
    sheet,
    copy.daily,
    [
      copy.date,
      copy.totalRevenue,
      copy.cashRevenue,
      copy.transferRevenue,
      copy.otherRevenue,
      copy.orderCount,
      copy.averageOrder,
    ],
    [14, 20, 20, 22, 24, 14, 20],
  );
  data.dailyRows.forEach((item) =>
    sheet.addRow([
      excelDate(item.date),
      item.totalRevenue,
      item.cashRevenue,
      item.transferRevenue,
      item.otherRevenue,
      item.orderCount,
      item.orderCount > 0 ? item.totalRevenue / item.orderCount : 0,
    ]),
  );
  addTotalRow(sheet, 2, data.dailyRows.length, copy.total, [2, 3, 4, 5, 6]);
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  [2, 3, 4, 5, 7].forEach(
    (column) => (sheet.getColumn(column).numFmt = MONEY_FORMAT),
  );
  sheet.getColumn(6).numFmt = NUMBER_FORMAT;
  finishTable(sheet, 7);
}

export function addRevenuePaymentSheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  copy: RevenueWorkbookCopy,
) {
  const sheet = workbook.addWorksheet(copy.payments, sheetOptions(2));
  prepareTableSheet(
    sheet,
    copy.payments,
    [
      copy.paymentMethod,
      copy.category,
      copy.amount,
      copy.orderCount,
      copy.share,
    ],
    [30, 18, 22, 14, 14],
  );
  data.stats.paymentMethods.forEach((item) =>
    sheet.addRow([
      item.method,
      item.category,
      item.amount,
      item.orderCount,
      item.percentage / 100,
    ]),
  );
  addTotalRow(sheet, 2, data.stats.paymentMethods.length, copy.total, [3, 4]);
  sheet.getColumn(3).numFmt = MONEY_FORMAT;
  sheet.getColumn(4).numFmt = NUMBER_FORMAT;
  sheet.getColumn(5).numFmt = "0.0%";
  finishTable(sheet, 5);
}

export function addRevenueCompositionSheets(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  copy: RevenueWorkbookCopy,
) {
  const groups = workbook.addWorksheet(copy.groups, sheetOptions(2));
  prepareTableSheet(
    groups,
    copy.groups,
    [copy.group, copy.quantity, copy.revenue, copy.share],
    [36, 16, 22, 14],
  );
  const total = data.topProductGroups.reduce(
    (sum, group) => sum + group.revenue,
    0,
  );
  data.topProductGroups.forEach((group) =>
    groups.addRow([
      group.groupName,
      group.quantity,
      group.revenue,
      total > 0 ? group.revenue / total : 0,
    ]),
  );
  addTotalRow(groups, 2, data.topProductGroups.length, copy.total, [2, 3]);
  groups.getColumn(2).numFmt = NUMBER_FORMAT;
  groups.getColumn(3).numFmt = MONEY_FORMAT;
  groups.getColumn(4).numFmt = "0.0%";
  finishTable(groups, 4);
  const productsSheet = workbook.addWorksheet(copy.products, sheetOptions(2));
  prepareTableSheet(
    productsSheet,
    copy.products,
    [
      copy.group,
      copy.product,
      copy.quantity,
      copy.revenue,
      copy.averagePrice,
      copy.share,
    ],
    [30, 42, 16, 22, 22, 14],
  );
  const products = data.topProductGroups.flatMap((group) =>
    group.items.map((item) => ({ groupName: group.groupName, ...item })),
  );
  products.forEach((item) =>
    productsSheet.addRow([
      item.groupName,
      item.name,
      item.quantity,
      item.revenue,
      item.quantity > 0 ? item.revenue / item.quantity : 0,
      total > 0 ? item.revenue / total : 0,
    ]),
  );
  addTotalRow(productsSheet, 2, products.length, copy.total, [3, 4]);
  productsSheet.getColumn(3).numFmt = NUMBER_FORMAT;
  [4, 5].forEach(
    (column) => (productsSheet.getColumn(column).numFmt = MONEY_FORMAT),
  );
  productsSheet.getColumn(6).numFmt = "0.0%";
  finishTable(productsSheet, 6);
}
