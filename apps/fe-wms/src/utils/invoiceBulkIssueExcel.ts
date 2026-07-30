import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";
import ExcelJS from "exceljs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const HEADER_ROW = 9;

interface ExportLine {
  item_name: string;
  unit_name: string | null;
  quantity: number;
  unit_price: number | null;
  vat_rate_name: string | null;
  vat_rate: number | null;
  amount_without_vat: number | null;
  total_amount: number | null;
}

const excelDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value);
  if (!match) return value;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
};

const vatRate = (line: ExportLine) => {
  if (typeof line.vat_rate === "number") return line.vat_rate;
  const parsed = Number.parseFloat(line.vat_rate_name?.replace("%", "") ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

const fallbackLines = (
  invoice: InvoiceBulkIssuePreview["invoices"][number],
): ExportLine[] =>
  invoice.products.map((product) => {
    const isOnlyProduct = invoice.products.length === 1;
    const quantity = product.quantity;
    const amountWithoutVat = isOnlyProduct
      ? invoice.total_amount_without_vat
      : null;
    return {
      item_name: product.item_name,
      unit_name: product.unit_name,
      quantity,
      unit_price:
        isOnlyProduct && quantity !== 0
          ? invoice.total_amount_without_vat / quantity
          : null,
      vat_rate_name: null,
      vat_rate: null,
      amount_without_vat: amountWithoutVat,
      total_amount: isOnlyProduct ? invoice.total_amount : null,
    };
  });

const border: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9D9E8" } },
  left: { style: "thin", color: { argb: "FFD9D9E8" } },
  bottom: { style: "thin", color: { argb: "FFD9D9E8" } },
  right: { style: "thin", color: { argb: "FFD9D9E8" } },
};

const fill = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

export function buildInvoiceBulkIssueWorkbook(
  preview: InvoiceBulkIssuePreview,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "B.Duck WMS";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = "Joy World";
  workbook.subject = "Danh sách hóa đơn trước khi xuất";

  const sheet = workbook.addWorksheet("Hóa đơn GTGT", {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
    views: [
      {
        state: "frozen",
        ySplit: HEADER_ROW,
        showGridLines: false,
      },
    ],
  });

  const columns = [
    { key: "invoiceIndex", width: 13 },
    { key: "invoiceDate", width: 14 },
    { key: "buyerLegalName", width: 24 },
    { key: "buyerTaxCode", width: 16 },
    { key: "buyerAddress", width: 30 },
    { key: "buyerFullName", width: 24 },
    { key: "buyerEmail", width: 26 },
    { key: "buyerPhone", width: 16 },
    { key: "buyerIdentity", width: 18 },
    { key: "paymentMethod", width: 20 },
    { key: "vatRate", width: 16 },
    { key: "invoiceVat", width: 18 },
    { key: "itemName", width: 52 },
    { key: "unitName", width: 12 },
    { key: "quantity", width: 12 },
    { key: "unitPrice", width: 18 },
    { key: "amountWithoutVat", width: 19 },
    { key: "totalAmount", width: 19 },
    { key: "orderNumber", width: 32 },
    { key: "paymentTime", width: 27 },
  ];
  sheet.columns = columns;

  sheet.mergeCells("A1:T1");
  sheet.getCell("A1").value =
    "DANH SÁCH HÓA ĐƠN KIỂM TRA TRƯỚC KHI XUẤT";
  sheet.getCell("A1").font = {
    name: "Times New Roman",
    size: 18,
    bold: true,
    color: { argb: "FF000000" },
  };
  sheet.getCell("A1").fill = fill("FF99CCFF");
  sheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  sheet.getRow(1).height = 30;

  const instructions = [
    "Hướng dẫn:",
    "- File được xuất từ màn hình Kiểm tra danh sách trước khi xuất hóa đơn.",
    "- Mỗi hóa đơn có thể gồm nhiều dòng hàng hóa; các dòng có cùng số thứ tự thuộc cùng một hóa đơn.",
    "- Tiền thuế GTGT chỉ hiển thị tại dòng đầu tiên của từng hóa đơn để thuận tiện đối chiếu.",
    "- Các cột Mã đơn hàng và Thời gian thanh toán được bổ sung để truy vết dữ liệu nguồn.",
    `- Ngày dữ liệu: ${preview.business_date} · Phạm vi: ${
      preview.selection_mode === "ALL"
        ? "Tất cả đơn trong ngày"
        : "Các đơn đã chọn"
    }`,
  ];
  instructions.forEach((instruction, index) => {
    const rowNumber = index + 2;
    sheet.mergeCells(rowNumber, 1, rowNumber, columns.length);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = instruction;
    cell.fill = fill("FFFFCC99");
    cell.font = {
      name: "Times New Roman",
      size: 12,
      bold: index === 0,
      color: { argb: index === 0 || index === 3 ? "FFFF0000" : "FF000000" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(rowNumber).height = index === 0 ? 22 : 24;
  });

  sheet.mergeCells("A8:K8");
  sheet.getCell("A8").value = "TỔNG CỘNG";
  sheet.getCell("L8").value = preview.summary.total_vat_amount;
  sheet.getCell("O8").value = preview.summary.product_quantity;
  sheet.getCell("Q8").value = preview.summary.total_amount_without_vat;
  sheet.getCell("R8").value = preview.summary.total_amount;
  sheet.getRow(8).font = {
    name: "Times New Roman",
    size: 12,
    bold: true,
  };
  sheet.getRow(8).alignment = { vertical: "middle" };
  sheet.getRow(8).height = 22;
  sheet.getCell("A8").alignment = { horizontal: "right" };
  ["A8", "L8", "O8", "Q8", "R8"].forEach((address) => {
    sheet.getCell(address).fill = fill("FFE2F0D9");
    sheet.getCell(address).border = border;
  });

  const headers = [
    "Số thứ tự hóa đơn (*)",
    "Ngày hóa đơn",
    "Tên đơn vị mua hàng",
    "Mã số thuế",
    "Địa chỉ",
    "Người mua hàng",
    "Email",
    "Số điện thoại",
    "Căn cước công dân",
    "Hình thức thanh toán (*)",
    "Thuế suất GTGT (%)",
    "Tiền thuế GTGT",
    "Tên hàng hóa/dịch vụ (*)",
    "ĐVT",
    "Số lượng",
    "Đơn giá",
    "Thành tiền trước thuế",
    "Thành tiền sau thuế",
    "Mã đơn hàng",
    "Thời gian thanh toán",
  ];
  const headerRow = sheet.getRow(HEADER_ROW);
  headerRow.values = headers;
  headerRow.height = 46;
  headerRow.eachCell((cell, columnNumber) => {
    cell.font = {
      name: "Times New Roman",
      size: 12,
      bold: true,
      color: { argb: "FF000000" },
    };
    cell.fill = fill(
      columnNumber <= 12
        ? "FFCCCCFF"
        : columnNumber <= 18
          ? "FFFFFF00"
          : "FFDDEBF7",
    );
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = border;
  });

  preview.invoices.forEach((invoice, invoiceIndex) => {
    const lines =
      invoice.lines?.length > 0 ? invoice.lines : fallbackLines(invoice);
    lines.forEach((line, lineIndex) => {
      const row = sheet.addRow({
        invoiceIndex: invoiceIndex + 1,
        invoiceDate: excelDate(preview.business_date),
        buyerLegalName: invoice.buyer?.legal_name || null,
        buyerTaxCode: invoice.buyer?.tax_code || null,
        buyerAddress: invoice.buyer?.address || null,
        buyerFullName:
          invoice.buyer?.full_name || "Bán cho người tiêu dùng",
        buyerEmail: invoice.buyer?.email || null,
        buyerPhone: invoice.buyer?.phone_number || null,
        buyerIdentity: null,
        paymentMethod: invoice.payment_method_name || "TM/CK",
        vatRate: vatRate(line),
        invoiceVat: lineIndex === 0 ? invoice.total_vat_amount : null,
        itemName: line.item_name,
        unitName: line.unit_name || null,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        amountWithoutVat: line.amount_without_vat,
        totalAmount: line.total_amount,
        orderNumber: invoice.order_number ?? invoice.source_order_id,
        paymentTime: invoice.payment_time,
      });
      row.font = { name: "Times New Roman", size: 11 };
      row.alignment = { vertical: "middle" };
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.border = border;
        cell.alignment = {
          vertical: "middle",
          horizontal:
            columnNumber >= 11 && columnNumber <= 18 ? "right" : "left",
          wrapText: columnNumber === 5 || columnNumber === 13,
        };
      });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(14).alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  const lastRow = Math.max(sheet.rowCount, HEADER_ROW);
  const formulaEndRow = Math.max(lastRow, HEADER_ROW + 1);
  (
    [
      ["L8", "L", preview.summary.total_vat_amount],
      ["O8", "O", preview.summary.product_quantity],
      ["Q8", "Q", preview.summary.total_amount_without_vat],
      ["R8", "R", preview.summary.total_amount],
    ] as const
  ).forEach(([address, column, result]) => {
    sheet.getCell(address).value = {
      formula: `SUM(${column}${HEADER_ROW + 1}:${column}${formulaEndRow})`,
      result,
    };
  });
  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: lastRow, column: columns.length },
  };
  sheet.getColumn(2).numFmt = "dd/mm/yyyy";
  [4, 8, 9, 19, 20].forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = "@";
  });
  sheet.getColumn(11).numFmt = "0.##";
  sheet.getColumn(12).numFmt = "#,##0;[Red](#,##0);-";
  sheet.getColumn(15).numFmt = "#,##0.##";
  [16, 17, 18].forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = "#,##0;[Red](#,##0);-";
  });
  ["L8", "Q8", "R8"].forEach((address) => {
    sheet.getCell(address).numFmt = "#,##0;[Red](#,##0);-";
  });
  sheet.getCell("O8").numFmt = "#,##0.##";
  sheet.pageSetup.printTitlesRow = "1:9";
  sheet.pageSetup.margins = {
    left: 0.25,
    right: 0.25,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };

  return workbook;
}

export async function downloadInvoiceBulkIssueExcel(
  preview: InvoiceBulkIssuePreview,
): Promise<void> {
  const workbook = buildInvoiceBulkIssueWorkbook(preview);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const time = new Date()
    .toLocaleTimeString("vi-VN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replaceAll(":", "");

  link.href = url;
  link.download = `HD_MTT_${preview.business_date.replaceAll("-", "")}_${time}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
