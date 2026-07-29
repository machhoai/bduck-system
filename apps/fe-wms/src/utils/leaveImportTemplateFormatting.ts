import {
  LEAVE_IMPORT_MAX_ROWS,
  LeaveImportRecordType,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";
import {
  getTemplateLabel,
  leaveImportTechnicalColumns,
  type LeaveImportTemplateOption,
} from "./leaveImportTemplateOptions";

const REFS_SHEET = "_refs";
const HISTORICAL_UNITS_COLUMN = "M";
const POSITIVE_UNITS_COLUMN = "N";
const ADJUSTMENT_UNITS_COLUMN = "O";
const MAX_UNITS = 365;
const UNITS_PER_DAY = 2;

export const writeLeaveImportReferencePair = (
  sheet: ExcelJS.Worksheet,
  labelColumn: number,
  codeColumn: number,
  header: string,
  options: LeaveImportTemplateOption[],
) => {
  sheet.getCell(1, labelColumn).value = `${header}_label`;
  sheet.getCell(1, codeColumn).value = `${header}_code`;
  options.forEach((option, index) => {
    sheet.getCell(index + 2, labelColumn).value = option.label;
    sheet.getCell(index + 2, codeColumn).value = option.code;
  });
};

export const writeLeaveImportUnitReferences = (sheet: ExcelJS.Worksheet) => {
  const positiveUnits = Array.from(
    { length: MAX_UNITS * UNITS_PER_DAY },
    (_, index) => (index + 1) / UNITS_PER_DAY,
  );
  const adjustmentUnits = [
    ...positiveUnits,
    ...positiveUnits.map((units) => -units),
  ];

  sheet.getCell(`${HISTORICAL_UNITS_COLUMN}1`).value = "historical_units";
  sheet.getCell(`${POSITIVE_UNITS_COLUMN}1`).value = "positive_units";
  sheet.getCell(`${ADJUSTMENT_UNITS_COLUMN}1`).value = "adjustment_units";
  [0.5, 1].forEach((units, index) => {
    sheet.getCell(`${HISTORICAL_UNITS_COLUMN}${index + 2}`).value = units;
  });
  positiveUnits.forEach((units, index) => {
    sheet.getCell(`${POSITIVE_UNITS_COLUMN}${index + 2}`).value = units;
  });
  adjustmentUnits.forEach((units, index) => {
    sheet.getCell(`${ADJUSTMENT_UNITS_COLUMN}${index + 2}`).value = units;
  });
};

export const addLeaveImportListValidation = (
  sheet: ExcelJS.Worksheet,
  column: string,
  referenceColumn: string,
  optionCount: number,
  labels: Record<string, string>,
  allowBlank: boolean,
) => {
  for (let row = 3; row <= LEAVE_IMPORT_MAX_ROWS + 2; row += 1) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: "list",
      allowBlank,
      formulae: [
        `'${REFS_SHEET}'!$${referenceColumn}$2:$${referenceColumn}$${
          optionCount + 1
        }`,
      ],
      showInputMessage: true,
      promptTitle: getTemplateLabel(
        labels,
        "leaveImportChooseFromList",
        "Choose",
      ),
      prompt: getTemplateLabel(
        labels,
        "leaveImportChooseFromListHint",
        "Choose a value from the dropdown list.",
      ),
      showErrorMessage: true,
      errorTitle: getTemplateLabel(
        labels,
        "leaveImportInvalidSelection",
        "Invalid value",
      ),
      error: getTemplateLabel(
        labels,
        "leaveImportInvalidSelectionHint",
        "Please choose a value from the dropdown list.",
      ),
    };
  }
};

export const styleLeaveImportDataSheet = (
  sheet: ExcelJS.Worksheet,
  headers: string[],
) => {
  sheet.columns = leaveImportTechnicalColumns.map(([, width]) => ({ width }));
  sheet.getRow(1).values = headers;
  sheet.getRow(2).values = leaveImportTechnicalColumns.map(([key]) => key);
  sheet.getRow(2).hidden = true;
  sheet.getRow(1).height = 34;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  for (let row = 3; row <= LEAVE_IMPORT_MAX_ROWS + 2; row += 1) {
    const dataRow = sheet.getRow(row);
    dataRow.height = 24;
    for (let columnNumber = 1; columnNumber <= 10; columnNumber += 1) {
      const cell = dataRow.getCell(columnNumber);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: [1, 3, 5, 7, 8, 9].includes(columnNumber)
            ? "FFEFF6FF"
            : "FFF8FAFC",
        },
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = { vertical: "middle", wrapText: columnNumber === 10 };
    }
  }
  sheet.getColumn(4).numFmt = "yyyy-mm-dd";
  sheet.getColumn(5).numFmt = "0";
  sheet.getColumn(6).numFmt = "0.0";
  sheet.autoFilter = `A1:J${LEAVE_IMPORT_MAX_ROWS + 2}`;
};

export const addLeaveImportScalarValidations = (
  sheet: ExcelJS.Worksheet,
  labels: Record<string, string>,
  recordTypes: LeaveImportTemplateOption[],
) => {
  const referenceRowFor = (recordType: LeaveImportRecordType) => {
    const index = recordTypes.findIndex((option) => option.code === recordType);
    if (index < 0)
      throw new Error(`LEAVE_IMPORT_RECORD_TYPE_MISSING:${recordType}`);
    return index + 2;
  };
  const historicalRow = referenceRowFor(
    LeaveImportRecordType.HISTORICAL_REQUEST,
  );
  const adjustmentRow = referenceRowFor(LeaveImportRecordType.ADJUSTMENT);
  const historicalUnitsRange =
    `'${REFS_SHEET}'!$${HISTORICAL_UNITS_COLUMN}$2:` +
    `$${HISTORICAL_UNITS_COLUMN}$3`;
  const positiveUnitsRange =
    `'${REFS_SHEET}'!$${POSITIVE_UNITS_COLUMN}$2:` +
    `$${POSITIVE_UNITS_COLUMN}$${MAX_UNITS * UNITS_PER_DAY + 1}`;
  const adjustmentUnitsRange =
    `'${REFS_SHEET}'!$${ADJUSTMENT_UNITS_COLUMN}$2:` +
    `$${ADJUSTMENT_UNITS_COLUMN}$${MAX_UNITS * UNITS_PER_DAY * 2 + 1}`;

  for (let row = 3; row <= LEAVE_IMPORT_MAX_ROWS + 2; row += 1) {
    sheet.getCell(`B${row}`).dataValidation = {
      type: "textLength",
      operator: "between",
      allowBlank: false,
      formulae: [1, 100],
      showErrorMessage: true,
      errorTitle: getTemplateLabel(
        labels,
        "leaveImportInvalidValue",
        "Invalid value",
      ),
      error: getTemplateLabel(
        labels,
        "leaveImportInvalidReferenceHint",
        "Enter a unique reference of up to 100 characters.",
      ),
    };
    sheet.getCell(`D${row}`).dataValidation = {
      type: "date",
      operator: "between",
      allowBlank: false,
      formulae: [new Date(2000, 0, 1), new Date(2100, 11, 31)],
      showErrorMessage: true,
      errorTitle: getTemplateLabel(
        labels,
        "leaveImportInvalidValue",
        "Invalid value",
      ),
      error: getTemplateLabel(
        labels,
        "leaveImportInvalidDateHint",
        "Enter a date between 2000-01-01 and 2100-12-31.",
      ),
    };
    sheet.getCell(`F${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [
        `IF(OR($A${row}='${REFS_SHEET}'!$A$${historicalRow},` +
          `$A${row}='${REFS_SHEET}'!$B$${historicalRow}),` +
          `${historicalUnitsRange},IF(OR(` +
          `$A${row}='${REFS_SHEET}'!$A$${adjustmentRow},` +
          `$A${row}='${REFS_SHEET}'!$B$${adjustmentRow}),` +
          `${adjustmentUnitsRange},${positiveUnitsRange}))`,
      ],
      showInputMessage: true,
      promptTitle: getTemplateLabel(
        labels,
        "leaveImportChooseFromList",
        "Choose",
      ),
      prompt: getTemplateLabel(
        labels,
        "leaveImportInvalidUnitsHint",
        "Choose units from the dropdown list.",
      ),
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: getTemplateLabel(
        labels,
        "leaveImportInvalidSelection",
        "Invalid value",
      ),
      error: getTemplateLabel(
        labels,
        "leaveImportInvalidUnitsHint",
        "Units must be in increments of 0.5.",
      ),
    };
    sheet.getCell(`J${row}`).dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: true,
      formulae: [1000],
    };
  }
};

export const fillLeaveImportGuide = (
  sheet: ExcelJS.Worksheet,
  labels: Record<string, string>,
  recordTypes: LeaveImportTemplateOption[],
) => {
  sheet.views = [{ showGridLines: false }];
  sheet.columns = [{ width: 28 }, { width: 32 }, { width: 76 }];
  sheet.addRow([labels.leaveImportGuideTitle]);
  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FF1E3A8A" },
  };
  [
    labels.leaveImportGuideVersion,
    labels.leaveImportGuideEmployee,
    labels.leaveImportGuideSelections,
    labels.leaveImportGuideReference,
    labels.leaveImportGuideOrdering,
    labels.leaveImportGuideHistorical,
    labels.leaveImportGuideLedger,
  ].forEach((text) => {
    const row = sheet.addRow([null, null, text]);
    row.height = 30;
  });
  sheet.addRow([]);
  const definitionHeader = sheet.addRow([
    labels.leaveImportGuideMeaning,
    labels.leaveImportGuideCode,
    labels.leaveImportGuideDescription,
  ]);
  definitionHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  definitionHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };
  recordTypes.forEach((option) =>
    sheet.addRow([
      option.label,
      option.code,
      getTemplateLabel(
        labels,
        `leaveImportDescription${option.code}`,
        option.label,
      ),
    ]),
  );
  sheet.getColumn(3).alignment = { wrapText: true, vertical: "top" };
};
