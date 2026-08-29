import type {
  RevenueDashboardData,
  RevenueExportReportType,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

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

const COPY = {
  vi: {
    revenueTitle: "BÁO CÁO DOANH THU",
    salesTitle: "BÁO CÁO CƠ CẤU BÁN HÀNG",
    summary: "Tổng quan",
    daily: "Doanh thu từng ngày",
    payments: "Cơ cấu thanh toán",
    groups: "Theo nhóm sản phẩm",
    products: "Chi tiết sản phẩm",
    store: "Cửa hàng",
    range: "Phạm vi",
    source: "Nguồn dữ liệu",
    taxSource: "Nguồn dữ liệu thuế",
    generated: "Thời điểm xuất",
    totalRevenue: "Tổng doanh thu",
    cashRevenue: "Doanh thu tiền mặt",
    transferRevenue: "Doanh thu chuyển khoản",
    otherRevenue: "Doanh thu phương thức khác",
    totalTax: "Tổng tiền thuế",
    beforeTax: "Doanh thu trước thuế",
    totalOrders: "Tổng đơn hàng",
    averageOrder: "Giá trị đơn trung bình",
    date: "Ngày",
    paymentMethod: "Phương thức",
    category: "Phân loại",
    amount: "Số tiền",
    orderCount: "Số đơn",
    share: "Tỷ trọng",
    group: "Nhóm sản phẩm",
    product: "Sản phẩm",
    quantity: "Số lượng",
    revenue: "Doanh thu",
    tax: "Tiền thuế",
    averagePrice: "Giá bán trung bình",
    total: "TỔNG CỘNG",
    openApi: "OpenAPI",
    localPos: "POS local",
  },
  zh: {
    revenueTitle: "营收报表",
    salesTitle: "销售结构报表",
    summary: "汇总",
    daily: "每日营收",
    payments: "支付结构",
    groups: "按商品组",
    products: "商品明细",
    store: "门店",
    range: "日期范围",
    source: "数据来源",
    taxSource: "税额数据来源",
    generated: "导出时间",
    totalRevenue: "总营收",
    cashRevenue: "现金营收",
    transferRevenue: "转账营收",
    otherRevenue: "其他支付营收",
    totalTax: "税额合计",
    beforeTax: "未税营收",
    totalOrders: "订单总数",
    averageOrder: "平均订单金额",
    date: "日期",
    paymentMethod: "支付方式",
    category: "分类",
    amount: "金额",
    orderCount: "订单数",
    share: "占比",
    group: "商品组",
    product: "商品",
    quantity: "数量",
    revenue: "营收",
    tax: "税额",
    averagePrice: "平均售价",
    total: "合计",
    openApi: "OpenAPI",
    localPos: "本地 POS",
  },
} as const;

export async function buildRevenueWorkbook(
  dashboard: RevenueDashboardData,
  reportType: RevenueExportReportType,
  locale: "vi" | "zh",
): Promise<Buffer> {
  const copy = COPY[locale];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "B.Duck System";
  workbook.company = "B.Duck";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.subject =
    reportType === "DAILY_REVENUE" ? copy.revenueTitle : copy.salesTitle;

  addSummarySheet(workbook, dashboard, reportType, copy);
  if (reportType === "DAILY_REVENUE") {
    addDailySheet(workbook, dashboard, copy);
    addPaymentSheet(workbook, dashboard, copy);
  } else {
    addGroupSheet(workbook, dashboard, copy);
    addProductSheet(workbook, dashboard, copy);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  reportType: RevenueExportReportType,
  copy: (typeof COPY)["vi"] | (typeof COPY)["zh"],
) {
  const sheet = workbook.addWorksheet(copy.summary, sheetOptions(1));
  sheet.columns = [{ width: 34 }, { width: 28 }, { width: 34 }, { width: 28 }];
  title(sheet, reportType === "DAILY_REVENUE" ? copy.revenueTitle : copy.salesTitle, 4);
  const source = data.source === "OPEN_API" ? copy.openApi : copy.localPos;
  const metadata = [
    [copy.store, data.warehouseName, copy.range, `${data.range.startDate} – ${data.range.endDate}`],
    [copy.source, source, copy.taxSource, data.taxSource === "LOCAL_POS" ? copy.localPos : copy.openApi],
    [copy.generated, new Date(data.generatedAt), "", ""],
  ];
  metadata.forEach((values, index) => {
    const row = sheet.getRow(index + 3);
    row.values = values;
    row.height = 24;
    [1, 3].forEach((column) => styleMetadataLabel(row.getCell(column)));
    [2, 4].forEach((column) => styleMetadataValue(row.getCell(column)));
  });
  sheet.getCell("B5").numFmt = "dd/mm/yyyy hh:mm";

  const metrics = [
    [copy.totalRevenue, data.stats.totalRevenue.value, copy.totalTax, data.stats.totalTax.value],
    [copy.cashRevenue, data.stats.cashRevenue.value, copy.beforeTax, data.stats.amountBeforeTax.value],
    [copy.transferRevenue, data.stats.transferRevenue.value, copy.totalOrders, data.stats.totalOrders.value],
    [copy.otherRevenue, data.stats.otherRevenue.value, copy.averageOrder, data.stats.averageOrderValue.value],
  ];
  metrics.forEach((values, index) => {
    const row = sheet.getRow(index + 8);
    row.values = values;
    row.height = 30;
    [1, 3].forEach((column) => styleMetricLabel(row.getCell(column)));
    [2, 4].forEach((column) => styleMetricValue(row.getCell(column)));
  });
  ["B8", "D8", "B9", "D9", "B10", "B11", "D11"].forEach(
    (address) => (sheet.getCell(address).numFmt = MONEY_FORMAT),
  );
  sheet.getCell("D10").numFmt = NUMBER_FORMAT;
}

function addDailySheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  copy: (typeof COPY)["vi"] | (typeof COPY)["zh"],
) {
  const sheet = workbook.addWorksheet(copy.daily, sheetOptions(2));
  const headers = [copy.date, copy.totalRevenue, copy.cashRevenue, copy.transferRevenue, copy.otherRevenue, copy.tax, copy.beforeTax, copy.orderCount, copy.averageOrder];
  prepareTableSheet(sheet, copy.daily, headers, [14, 20, 20, 22, 24, 18, 20, 14, 20]);
  data.dailyRows.forEach((item) => {
    sheet.addRow([
      excelDate(item.date), item.totalRevenue, item.cashRevenue,
      item.transferRevenue, item.otherRevenue, item.totalTax,
      item.amountBeforeTax, item.orderCount,
      item.orderCount > 0 ? item.totalRevenue / item.orderCount : 0,
    ]);
  });
  addTotalRow(sheet, 2, data.dailyRows.length, copy.total, [2, 3, 4, 5, 6, 7, 8]);
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  [2, 3, 4, 5, 6, 7, 9].forEach((column) => (sheet.getColumn(column).numFmt = MONEY_FORMAT));
  sheet.getColumn(8).numFmt = NUMBER_FORMAT;
  finishTable(sheet, 9);
}

function addPaymentSheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  copy: (typeof COPY)["vi"] | (typeof COPY)["zh"],
) {
  const sheet = workbook.addWorksheet(copy.payments, sheetOptions(2));
  prepareTableSheet(sheet, copy.payments, [copy.paymentMethod, copy.category, copy.amount, copy.orderCount, copy.share], [30, 18, 22, 14, 14]);
  data.stats.paymentMethods.forEach((item) => sheet.addRow([item.method, item.category, item.amount, item.orderCount, item.percentage / 100]));
  addTotalRow(sheet, 2, data.stats.paymentMethods.length, copy.total, [3, 4]);
  sheet.getColumn(3).numFmt = MONEY_FORMAT;
  sheet.getColumn(4).numFmt = NUMBER_FORMAT;
  sheet.getColumn(5).numFmt = "0.0%";
  finishTable(sheet, 5);
}

function addGroupSheet(workbook: ExcelJS.Workbook, data: RevenueDashboardData, copy: (typeof COPY)["vi"] | (typeof COPY)["zh"]) {
  const sheet = workbook.addWorksheet(copy.groups, sheetOptions(2));
  prepareTableSheet(sheet, copy.groups, [copy.group, copy.quantity, copy.revenue, copy.tax, copy.share], [36, 16, 22, 18, 14]);
  const total = data.topProductGroups.reduce((sum, group) => sum + group.revenue, 0);
  data.topProductGroups.forEach((group) => sheet.addRow([group.groupName, group.quantity, group.revenue, group.taxAmount ?? 0, total > 0 ? group.revenue / total : 0]));
  addTotalRow(sheet, 2, data.topProductGroups.length, copy.total, [2, 3, 4]);
  sheet.getColumn(2).numFmt = NUMBER_FORMAT;
  [3, 4].forEach((column) => (sheet.getColumn(column).numFmt = MONEY_FORMAT));
  sheet.getColumn(5).numFmt = "0.0%";
  finishTable(sheet, 5);
}

function addProductSheet(workbook: ExcelJS.Workbook, data: RevenueDashboardData, copy: (typeof COPY)["vi"] | (typeof COPY)["zh"]) {
  const sheet = workbook.addWorksheet(copy.products, sheetOptions(2));
  prepareTableSheet(sheet, copy.products, [copy.group, copy.product, copy.quantity, copy.revenue, copy.tax, copy.averagePrice, copy.share], [30, 42, 16, 22, 18, 22, 14]);
  const products = data.topProductGroups.flatMap((group) => group.items.map((item) => ({ groupName: group.groupName, ...item })));
  const total = products.reduce((sum, item) => sum + item.revenue, 0);
  products.forEach((item) => sheet.addRow([item.groupName, item.name, item.quantity, item.revenue, item.taxAmount ?? 0, item.quantity > 0 ? item.revenue / item.quantity : 0, total > 0 ? item.revenue / total : 0]));
  addTotalRow(sheet, 2, products.length, copy.total, [3, 4, 5]);
  sheet.getColumn(3).numFmt = NUMBER_FORMAT;
  [4, 5, 6].forEach((column) => (sheet.getColumn(column).numFmt = MONEY_FORMAT));
  sheet.getColumn(7).numFmt = "0.0%";
  finishTable(sheet, 7);
}
