import type ExcelJS from "exceljs";

type ReferenceKey =
  | "record_type"
  | "request_type"
  | "request_status"
  | "day_portion"
  | "employee"
  | "leave_year";

export type LeaveImportReferenceMaps = Record<
  ReferenceKey,
  Map<string, string>
>;

const referenceKey = (value: string) => value.trim().toLocaleUpperCase();

export const buildLeaveImportReferenceMaps = (
  sheet: ExcelJS.Worksheet | undefined,
  cellText: (cell: ExcelJS.Cell) => string,
): LeaveImportReferenceMaps => {
  const result: LeaveImportReferenceMaps = {
    record_type: new Map(),
    request_type: new Map(),
    request_status: new Map(),
    day_portion: new Map(),
    employee: new Map(),
    leave_year: new Map(),
  };
  if (!sheet) return result;
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    columns.set(cellText(cell), columnNumber);
  });
  (Object.keys(result) as ReferenceKey[]).forEach((key) => {
    const labelColumn = columns.get(`${key}_label`);
    const codeColumn = columns.get(`${key}_code`);
    if (!labelColumn || !codeColumn) return;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const optionLabel = cellText(row.getCell(labelColumn));
      const optionCode = cellText(row.getCell(codeColumn));
      if (!optionLabel || !optionCode) return;
      result[key].set(referenceKey(optionLabel), optionCode);
      result[key].set(referenceKey(optionCode), optionCode);
    });
  });
  return result;
};

export const resolveLeaveImportReference = (
  value: string,
  references: Map<string, string>,
) => references.get(referenceKey(value)) ?? value;
