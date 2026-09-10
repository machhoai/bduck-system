import type ExcelJS from "exceljs";

const COLORS = {
  navy: "FF14324A",
  teal: "FF0F766E",
  cyan: "FFDDF4F1",
  blue: "FFE8F1F8",
  amber: "FFFFF2CC",
  white: "FFFFFFFF",
  ink: "FF172B3A",
  muted: "FF5F7180",
  border: "FFD5E0E7",
};

export const MONEY_FORMAT = '#,##0 "₫";[Red]-#,##0 "₫";-';
export const NUMBER_FORMAT = "#,##0.##";

export function prepareTableSheet(
  sheet: ExcelJS.Worksheet,
  heading: string,
  headers: string[],
  widths: number[],
) {
  sheet.columns = widths.map((width) => ({ width }));
  title(sheet, heading.toUpperCase(), headers.length);
  const row = sheet.getRow(2);
  row.values = headers;
  row.height = 34;
  row.eachCell((cell) => styleHeader(cell));
  sheet.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];
}

export function addTotalRow(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  dataLength: number,
  label: string,
  sumColumns: number[],
) {
  const rowNumber = headerRow + dataLength + 1;
  const firstDataRow = headerRow + 1;
  const lastDataRow = Math.max(firstDataRow, rowNumber - 1);
  const row = sheet.getRow(rowNumber);
  row.getCell(1).value = label;
  sumColumns.forEach((column) => {
    const letter = sheet.getColumn(column).letter;
    const result =
      dataLength > 0
        ? Array.from(
            { length: dataLength },
            (_, index) =>
              Number(sheet.getCell(firstDataRow + index, column).value) || 0,
          ).reduce((sum, value) => sum + value, 0)
        : 0;
    row.getCell(column).value =
      dataLength === 0
        ? 0
        : {
            formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
            result,
          };
  });
  row.height = 26;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: COLORS.ink } };
    cell.fill = solidFill(COLORS.amber);
    cell.border = border();
  });
}

export function finishTable(sheet: ExcelJS.Worksheet, columnCount: number) {
  const lastRow = sheet.rowCount;
  if (lastRow > 2) {
    sheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: lastRow - 1, column: columnCount },
    };
  }
  for (let rowNumber = 3; rowNumber < lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 23;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = border();
      cell.alignment = { vertical: "middle", wrapText: true };
      if (rowNumber % 2 === 0) cell.fill = solidFill(COLORS.blue);
    });
  }
  sheet.pageSetup.printTitlesRow = "1:2";
}

export function title(
  sheet: ExcelJS.Worksheet,
  value: string,
  columns: number,
) {
  sheet.mergeCells(1, 1, 1, columns);
  const cell = sheet.getCell(1, 1);
  cell.value = value;
  cell.font = { bold: true, size: 18, color: { argb: COLORS.white } };
  cell.fill = solidFill(COLORS.navy);
  cell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;
}

export function styleMetadataLabel(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: COLORS.muted } };
  cell.fill = solidFill(COLORS.blue);
  cell.border = border();
}

export function styleMetadataValue(cell: ExcelJS.Cell) {
  cell.font = { color: { argb: COLORS.ink } };
  cell.border = border();
}

export function styleMetricLabel(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: COLORS.ink } };
  cell.fill = solidFill(COLORS.cyan);
  cell.border = border();
  cell.alignment = { vertical: "middle" };
}

export function styleMetricValue(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 13, color: { argb: COLORS.teal } };
  cell.border = border();
  cell.alignment = { vertical: "middle", horizontal: "right" };
}

export function sheetOptions(
  fitToWidth: number,
): Partial<ExcelJS.AddWorksheetOptions> {
  return {
    properties: { defaultRowHeight: 21 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth,
      fitToHeight: 0,
      paperSize: 9,
    },
    views: [{ showGridLines: false }],
  };
}

export function excelDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: COLORS.white } };
  cell.fill = solidFill(COLORS.teal);
  cell.border = border();
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function border(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: COLORS.border },
  };
  return { top: side, right: side, bottom: side, left: side };
}
