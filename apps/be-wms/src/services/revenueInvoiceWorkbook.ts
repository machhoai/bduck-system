import type { RevenueDashboardData } from "@bduck/shared-types";
import type ExcelJS from "exceljs";

import {
  addTotalRow,
  finishTable,
  NUMBER_FORMAT,
  prepareTableSheet,
  sheetOptions,
} from "./revenueWorkbookFormatting.js";

const COPY = {
  vi: {
    sheet: "Tệp hóa đơn",
    total: "TỔNG CỘNG",
    headers: [
      "Cửa hàng",
      "Mã đơn hàng",
      "Thời gian thanh toán",
      "Tên sản phẩm",
      "Nhóm sản phẩm",
      "Số lượng",
      "Đơn giá trước thuế",
      "Thành tiền trước thuế",
      "Tiền thuế",
      "Thực thu",
      "Thanh toán",
      "Nhân viên",
    ],
  },
  zh: {
    sheet: "开票数据",
    total: "合计",
    headers: [
      "门店",
      "订单编号",
      "支付时间",
      "商品名称",
      "商品分组",
      "数量",
      "未税单价",
      "未税金额",
      "税额",
      "实收金额",
      "支付方式",
      "员工",
    ],
  },
};

export function invoiceExportAmounts(
  gross: number,
  tax: number,
  quantity: number,
  roundMoney: boolean,
) {
  const amount = roundMoney ? Math.round(gross) : gross;
  const taxAmount = roundMoney ? Math.round(tax) : tax;
  const beforeTax = amount - taxAmount;
  const unitPrice = quantity ? beforeTax / quantity : 0;
  return {
    amount,
    taxAmount,
    beforeTax,
    unitPrice: roundMoney ? Math.round(unitPrice) : unitPrice,
  };
}

export function addRevenueInvoiceSheet(
  workbook: ExcelJS.Workbook,
  data: RevenueDashboardData,
  locale: "vi" | "zh",
  roundMoney = false,
) {
  const copy = COPY[locale];
  const sheet = workbook.addWorksheet(copy.sheet, sheetOptions(1));
  prepareTableSheet(
    sheet,
    copy.sheet,
    copy.headers,
    [32, 25, 23, 38, 28, 12, 22, 24, 18, 22, 18, 22],
  );
  const items = [...data.soldItems].sort(
    (a, b) =>
      a.createTime.localeCompare(b.createTime) ||
      a.orderId.localeCompare(b.orderId),
  );
  items.forEach((item) => {
    const amounts = invoiceExportAmounts(
      item.realMoney,
      item.taxMoney ?? 0,
      item.qty,
      roundMoney,
    );
    const paidAt = new Date(item.createTime);
    const time = Number.isNaN(paidAt.getTime())
      ? item.createTime
      : new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "zh-CN", {
          timeZone: "Asia/Ho_Chi_Minh",
          dateStyle: "short",
          timeStyle: "medium",
          hour12: false,
        }).format(paidAt);
    sheet.addRow([
      item.warehouseName || item.warehouseId || data.warehouseName,
      item.orderNumber,
      time,
      item.goodsName,
      item.categoryName,
      item.qty,
      amounts.unitPrice,
      amounts.beforeTax,
      amounts.taxAmount,
      amounts.amount,
      item.payMethod,
      item.employeeName,
    ]);
  });
  addTotalRow(sheet, 2, items.length, copy.total, [6, 8, 9, 10]);
  sheet.getColumn(6).numFmt = NUMBER_FORMAT;
  [7, 8, 9, 10].forEach((column) => {
    sheet.getColumn(column).numFmt = roundMoney ? '#,##0 "₫"' : '#,##0.## "₫"';
  });
  finishTable(sheet, copy.headers.length);
}
