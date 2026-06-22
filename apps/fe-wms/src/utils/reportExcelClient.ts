import ExcelJS from "exceljs";

export interface ExcelGridCell {
  address: string;
  value: string;
}

export interface ExcelGridSheet {
  name: string;
  rows: ExcelGridCell[][];
}

export async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

export async function parseWorkbookGrid(file: File): Promise<ExcelGridSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook.worksheets.map((sheet) => {
    const rowCount = Math.min(Math.max(sheet.rowCount, 20), 80);
    const colCount = Math.min(Math.max(sheet.columnCount, 10), 26);
    const rows: ExcelGridCell[][] = [];
    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
      const row: ExcelGridCell[] = [];
      for (let colNumber = 1; colNumber <= colCount; colNumber += 1) {
        const cell = sheet.getCell(rowNumber, colNumber);
        const value =
          cell.value === null || cell.value === undefined
            ? ""
            : typeof cell.value === "object" && "formula" in cell.value
              ? `=${String(cell.value.formula)}`
              : String(cell.text || cell.value);
        row.push({ address: cell.address, value });
      }
      rows.push(row);
    }
    return { name: sheet.name, rows };
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
