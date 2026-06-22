import ExcelJS from "exceljs";
import type {
  ExcelCellMapping,
  ReportExcelMapping,
  ReportWorkbookSheetMeta,
} from "@bduck/shared-types";

export async function loadWorkbookFromBuffer(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

export function extractWorkbookMeta(
  workbook: ExcelJS.Workbook,
): { sheets: ReportWorkbookSheetMeta[] } {
  const sheets = workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    row_count: sheet.rowCount,
    column_count: sheet.columnCount,
    merged_cells: Array.isArray(sheet.model.merges)
      ? sheet.model.merges.map(String)
      : [],
  }));
  return { sheets };
}

function findWorksheet(workbook: ExcelJS.Workbook, sheetName: string) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw {
      statusCode: 400,
      messages: {
        vi: `Không tìm thấy sheet ${sheetName} trong file mẫu.`,
        zh: `模板文件中未找到工作表 ${sheetName}。`,
      },
    };
  }
  return sheet;
}

export function applyExcelMapping(
  workbook: ExcelJS.Workbook,
  mapping: ReportExcelMapping,
  resolvedValues: Map<string, string | number>,
) {
  for (const cellMapping of mapping.cell_mappings) {
    writeMappedCell(workbook, cellMapping, resolvedValues);
  }
}

function writeMappedCell(
  workbook: ExcelJS.Workbook,
  cellMapping: ExcelCellMapping,
  resolvedValues: Map<string, string | number>,
) {
  const sheet = findWorksheet(workbook, cellMapping.sheet_name);
  const value = resolvedValues.get(cellMapping.field_instance_id);
  if (value === undefined) return;
  sheet.getCell(cellMapping.cell).value = value;
}
