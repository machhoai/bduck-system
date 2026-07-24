"use client";

import {
  LEAVE_IMPORT_MAX_ROWS,
  LEAVE_IMPORT_TEMPLATE_VERSION,
  LeaveDayPortion,
  LeaveImportRecordType,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DATA_SHEET = "Leave_history";
const GUIDE_SHEET = "Guide";
const REFS_SHEET = "_refs";
const META_SHEET = "_meta";

const columns = [
  ["record_type", 24],
  ["source_reference", 24],
  ["employee_code", 18],
  ["posting_date", 16],
  ["leave_year", 14],
  ["units", 12],
  ["request_type", 20],
  ["request_status", 20],
  ["day_portion", 18],
  ["reason", 48],
] as const;

export const validateLeaveImportFile = (
  file: File,
  labels: Record<string, string>,
): string | null => {
  if (
    !file.name.toLowerCase().endsWith(".xlsx") ||
    file.type === "application/x-msdownload"
  ) {
    return labels.leaveImportInvalidFileType;
  }
  if (file.size > MAX_FILE_BYTES) {
    return labels.leaveImportFileTooLarge;
  }
  return null;
};

export const calculateLeaveImportChecksum = async (
  file: File,
): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const styleHeader = (sheet: ExcelJS.Worksheet) => {
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
};

const addValidation = (
  sheet: ExcelJS.Worksheet,
  column: string,
  range: string,
) => {
  for (let row = 2; row <= LEAVE_IMPORT_MAX_ROWS + 1; row += 1) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`'${REFS_SHEET}'!${range}`],
      showErrorMessage: true,
    };
  }
};

const fillRefs = (sheet: ExcelJS.Worksheet) => {
  const lists = [
    Object.values(LeaveImportRecordType),
    Object.values(LeaveRequestType),
    [
      LeaveRequestStatus.APPROVED,
      LeaveRequestStatus.REJECTED,
      LeaveRequestStatus.CANCELLED,
    ],
    Object.values(LeaveDayPortion),
  ];
  lists.forEach((values, columnIndex) =>
    values.forEach((value, rowIndex) => {
      sheet.getCell(rowIndex + 1, columnIndex + 1).value = value;
    }),
  );
  sheet.state = "veryHidden";
};

const fillGuide = (
  sheet: ExcelJS.Worksheet,
  labels: Record<string, string>,
) => {
  sheet.columns = [{ width: 28 }, { width: 88 }];
  sheet.addRow([labels.leaveImportGuideTitle]);
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FF1E3A8A" },
  };
  [
    labels.leaveImportGuideVersion,
    labels.leaveImportGuideReference,
    labels.leaveImportGuideOrdering,
    labels.leaveImportGuideHistorical,
    labels.leaveImportGuideLedger,
  ].forEach((text) => sheet.addRow(["", text]));
  sheet.addRow([]);
  sheet.addRow([labels.leaveImportGuideCode, labels.leaveImportGuideMeaning]);
  const definitions = [
    ["HISTORICAL_REQUEST", labels.leaveImportTypeHistorical],
    ["ACCRUAL", labels.leaveImportTypeAccrual],
    ["USED", labels.leaveImportTypeUsed],
    ["ADJUSTMENT", labels.leaveImportTypeAdjustment],
    ["EXPIRED", labels.leaveImportTypeExpired],
  ];
  definitions.forEach((definition) => sheet.addRow(definition));
  sheet.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(8).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };
};

export const downloadLeaveImportTemplate = async (
  labels: Record<string, string>,
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "J-PULSE";
  workbook.created = new Date();
  const dataSheet = workbook.addWorksheet(DATA_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  dataSheet.columns = columns.map(([header, width]) => ({
    header,
    key: header,
    width,
  }));
  styleHeader(dataSheet);
  dataSheet.autoFilter = `A1:J${LEAVE_IMPORT_MAX_ROWS + 1}`;
  addValidation(
    dataSheet,
    "A",
    `$A$1:$A$${Object.values(LeaveImportRecordType).length}`,
  );
  addValidation(
    dataSheet,
    "G",
    `$B$1:$B$${Object.values(LeaveRequestType).length}`,
  );
  addValidation(dataSheet, "H", "$C$1:$C$3");
  addValidation(
    dataSheet,
    "I",
    `$D$1:$D$${Object.values(LeaveDayPortion).length}`,
  );

  fillGuide(workbook.addWorksheet(GUIDE_SHEET), labels);
  fillRefs(workbook.addWorksheet(REFS_SHEET));
  const metaSheet = workbook.addWorksheet(META_SHEET);
  metaSheet.getCell("A1").value = "template_version";
  metaSheet.getCell("B1").value = LEAVE_IMPORT_TEMPLATE_VERSION;
  metaSheet.state = "veryHidden";

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = labels.leaveImportTemplateFileName;
  link.click();
  URL.revokeObjectURL(url);
};
