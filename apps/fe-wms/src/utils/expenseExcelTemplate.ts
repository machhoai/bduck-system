import { ExpenseCostCenter } from "@bduck/shared-types";
import ExcelJS from "exceljs";
import {
  EXPENSE_CATEGORY_CONFIGS,
  EXPENSE_COST_CENTER_ORDER,
} from "./expenseConfig";
import type {
  ExpenseImportColumnKey,
  ExpenseImportLabels,
  ExpenseTemplateText,
} from "./expenseExcelTypes";

const EXPENSE_TEMPLATE_COLUMNS: ExpenseImportColumnKey[] = [
  "costCenter",
  "itemCode",
  "itemName",
  "budgetAmount",
  "actualAmount",
  "note",
];

export async function downloadExpenseImportTemplate(options: {
  labels: ExpenseImportLabels;
  text: ExpenseTemplateText;
}) {
  const { labels, text } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "J-PULSE";
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet(text.sheets.data, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guideSheet = workbook.addWorksheet(text.sheets.guide);
  const refsSheet = workbook.addWorksheet(text.sheets.refs);

  dataSheet.columns = EXPENSE_TEMPLATE_COLUMNS.map((key) => ({
    header: text.columns[key].label,
    key,
    width: text.columns[key].width,
  }));

  const refs = buildTemplateRefs(labels);
  fillRefsSheet(refsSheet, refs, text);
  addFixedRows(dataSheet, labels);
  addCustomSampleRow(dataSheet, labels, text);
  styleDataSheet(dataSheet, text);
  addDataValidations(dataSheet, {
    costCenterCount: refs.costCenterOptions.length,
    fixedItemCount: refs.fixedItemOptions.length,
    refsSheetName: text.sheets.refs,
    text,
  });
  addGuideSheet(guideSheet, text);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = text.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildTemplateRefs(labels: ExpenseImportLabels) {
  return {
    costCenterOptions: EXPENSE_COST_CENTER_ORDER.map(
      (costCenter) => `${costCenter} - ${labels.costCenter[costCenter]}`,
    ),
    fixedItemOptions: EXPENSE_CATEGORY_CONFIGS.map(
      (config) => `${config.key} - ${labels.category[config.key]}`,
    ),
  };
}

function addFixedRows(
  sheet: ExcelJS.Worksheet,
  labels: ExpenseImportLabels,
) {
  for (const config of EXPENSE_CATEGORY_CONFIGS) {
    sheet.addRow({
      costCenter: `${config.costCenter} - ${labels.costCenter[config.costCenter]}`,
      itemCode: `${config.key} - ${labels.category[config.key]}`,
      itemName: labels.category[config.key],
      budgetAmount: null,
      actualAmount: null,
      note: null,
    });
  }
}

function addCustomSampleRow(
  sheet: ExcelJS.Worksheet,
  labels: ExpenseImportLabels,
  text: ExpenseTemplateText,
) {
  const fallbackCostCenter = ExpenseCostCenter.OTHERS;
  sheet.addRow({
    costCenter: `${fallbackCostCenter} - ${labels.costCenter[fallbackCostCenter]}`,
    itemCode: "",
    itemName: text.sampleCustomName,
    budgetAmount: null,
    actualAmount: null,
    note: null,
  });
}

function fillRefsSheet(
  sheet: ExcelJS.Worksheet,
  refs: ReturnType<typeof buildTemplateRefs>,
  text: ExpenseTemplateText,
) {
  sheet.columns = [
    { header: text.refs.group, key: "group", width: 22 },
    { header: text.refs.value, key: "value", width: 46 },
    { header: text.refs.meaning, key: "meaning", width: 64 },
    { header: "_cost_centers", key: "_cost_centers", width: 1 },
    { header: "_fixed_items", key: "_fixed_items", width: 1 },
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  addReferenceGroup(sheet, text.refs.costCenter, refs.costCenterOptions);
  addReferenceGroup(sheet, text.refs.fixedItem, refs.fixedItemOptions);

  const maxRows = Math.max(
    refs.costCenterOptions.length,
    refs.fixedItemOptions.length,
  );
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const rowNumber = rowIndex + 2;
    sheet.getCell(rowNumber, 4).value = refs.costCenterOptions[rowIndex] ?? "";
    sheet.getCell(rowNumber, 5).value = refs.fixedItemOptions[rowIndex] ?? "";
  }

  [4, 5].forEach((columnNumber) => {
    sheet.getColumn(columnNumber).hidden = true;
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });
  });
}

function addReferenceGroup(
  sheet: ExcelJS.Worksheet,
  group: string,
  values: string[],
) {
  for (const value of values) {
    const [code, ...rest] = value.split(" - ");
    sheet.addRow({
      group,
      value,
      meaning: rest.join(" - ").trim() || code.trim(),
    });
  }
}

function styleDataSheet(sheet: ExcelJS.Worksheet, text: ExpenseTemplateText) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 34;

  EXPENSE_TEMPLATE_COLUMNS.forEach((key, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: text.columns[key].required ? "FFDC2626" : "FF2563EB",
      },
    };
    cell.border = thinBorder("FFCBD5E1");
    cell.note = text.columns[key].note;
  });

  for (let rowNumber = 2; rowNumber <= 201; rowNumber += 1) {
    sheet.getRow(rowNumber).height = 22;
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder("FFE2E8F0");
      cell.alignment = { vertical: "middle", wrapText: true };
      if (colNumber === 4 || colNumber === 5) {
        cell.numFmt = "#,##0";
      }
    });
  }

  sheet.autoFilter = { from: "A1", to: "F1" };
}

function addDataValidations(
  sheet: ExcelJS.Worksheet,
  config: {
    costCenterCount: number;
    fixedItemCount: number;
    refsSheetName: string;
    text: ExpenseTemplateText;
  },
) {
  const refsName = quoteSheetName(config.refsSheetName);
  for (let rowNumber = 2; rowNumber <= 201; rowNumber += 1) {
    sheet.getCell(`A${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$D$2:$D$${config.costCenterCount + 1}`,
      config.text.prompts.costCenter,
      config.text,
    );
    sheet.getCell(`B${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$E$2:$E$${config.fixedItemCount + 1}`,
      config.text.prompts.itemCode,
      config.text,
      true,
    );
    sheet.getCell(`C${rowNumber}`).dataValidation = {
      type: "textLength",
      operator: "greaterThan",
      formulae: [0],
      allowBlank: true,
      showInputMessage: true,
      promptTitle: config.text.prompts.title,
      prompt: config.text.prompts.itemName,
    };
    ["D", "E"].forEach((column) => {
      sheet.getCell(`${column}${rowNumber}`).dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        showInputMessage: true,
        promptTitle: config.text.prompts.title,
        prompt: config.text.prompts.amount,
        errorTitle: config.text.prompts.invalidTitle,
        error: config.text.prompts.invalidAmount,
      };
    });
  }
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function listValidation(
  range: string,
  prompt: string,
  text: ExpenseTemplateText,
  allowBlank = false,
): ExcelJS.DataValidation {
  return {
    type: "list",
    allowBlank,
    formulae: [range],
    showErrorMessage: true,
    showInputMessage: true,
    promptTitle: text.prompts.title,
    prompt,
    errorTitle: text.prompts.invalidTitle,
    error: text.prompts.invalidList,
  };
}

function addGuideSheet(sheet: ExcelJS.Worksheet, text: ExpenseTemplateText) {
  sheet.columns = [
    { header: text.guideHeaders.section, key: "section", width: 28 },
    { header: text.guideHeaders.guide, key: "guide", width: 96 },
  ];

  sheet.addRows(text.guides);

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });
  });
}

function thinBorder(color: string): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}
