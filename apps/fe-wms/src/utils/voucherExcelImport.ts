/**
 * voucherExcelImport.ts
 * ─────────────────────────────────────────────
 * Utility đọc file Excel (XLSX) tự do (không cần theo mẫu),
 * để người dùng map cột và import vào Phiếu Nhập Kho.
 *
 * Flow:
 * 1. readSheetPreview()   → đọc headers (A,B,C...) + sample row từ startRow
 * 2. parseVoucherRows()   → parse toàn bộ file theo columnMapping, match product
 * 3. summarizeResults()   → thống kê kết quả
 */

import ExcelJS from "exceljs";
import type { Product } from "@bduck/shared-types";

export interface ExcelSheetInfo {
  index: number;
  name: string;
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

/** Thông tin 1 cột từ sheet, gồm key (A/B/...) và giá trị mẫu tại startRow */
export interface SheetColumnInfo {
  /** Chữ cái cột: A, B, C, ... */
  key: string;
  /** Giá trị tại dòng mẫu (startRow) */
  sampleValue: string;
}

export interface SheetPreview {
  columns: SheetColumnInfo[];
  /** Tên sheet được đọc */
  sheetName: string;
  /** Tổng số hàng có dữ liệu (không kể header) */
  totalDataRows: number;
}

/** Mapping từ slot hệ thống → chữ cái cột file */
export interface VoucherColumnMapping {
  /** Tên sản phẩm (bắt buộc) */
  productName: string | null;
  /** SKU/Mã sản phẩm (tùy chọn, ưu tiên match) */
  sku: string | null;
  /** Số lượng (bắt buộc) */
  quantity: string | null;
  /** Đơn giá (tùy chọn) */
  unitPrice: string | null;
  /** Ghi chú (tùy chọn) */
  notes: string | null;
  /** Vị trí kho (tùy chọn, match theo code hoặc name) */
  location: string | null;
}

export interface VoucherItemParseResult {
  rowNumber: number;
  rawName: string;
  rawSku: string;
  rawQuantity: string;
  rawUnitPrice: string;
  rawNotes: string;
  /** Raw location value from Excel (trimmed) */
  rawLocation: string;
  /** Normalized location code for downstream matching */
  parsedLocationCode: string;
  matchedProduct: Product | null;
  parsedQuantity: number | null;
  parsedUnitPrice: number | null;
  errors: string[];
  warnings: string[];
}

export interface VoucherItemParseStats {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Chuyển index cột (0-indexed) sang chữ cái: 0→A, 1→B, ..., 25→Z, 26→AA */
function colIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/** Lấy text từ cell value (ExcelJS trả về nhiều kiểu).
 * Với cell kiểu number: trả về raw number string (không locale) để parse chính xác.
 * Với cell kiểu text có format VN (2.142,66): giữ nguyên string để parseLocaleNumber xử lý. */
function getCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  // Số thực từ ExcelJS (chưa bị format locale) → dùng trực tiếp
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join("");
  }
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    // Nếu kết quả công thức là số, trả về raw
    if (typeof r === "number") return String(r);
    return String(r ?? "");
  }
  if (v instanceof Date) return v.toLocaleDateString("vi-VN");
  return String(v);
}

const normalizeStr = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

/**
 * Parse số từ string hỗ trợ cả 2 định dạng locale phổ biến:
 *
 * • Tiếng Việt / EU: "2.142,66"  → dấu chấm = nghìn, dấu phẩy = thập phân → 2142.66
 * • Standard / US:  "2,142.66"  → dấu phẩy = nghìn, dấu chấm = thập phân → 2142.66
 * • Số nguyên:       "2142"     → 2142
 * • Đã là số JS:     "2142.66"  → 2142.66 (không có dấu phẩy)
 *
 * Heuristic: nếu dấu phẩy (,) xuất hiện SAU dấu chấm cuối cùng → VN format.
 */
function parseLocaleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return NaN;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastComma > lastDot) {
    // VN/EU format: 2.142,66 → remove dots, replace comma with dot
    const normalized = s.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized);
  }

  if (lastDot > lastComma) {
    // US format: 2,142.66 → remove commas
    const normalized = s.replace(/,/g, "");
    return parseFloat(normalized);
  }

  // Không có dấu phẩy hoặc chỉ có 1 loại
  return parseFloat(s.replace(/,/g, ""));
}

// ─────────────────────────────────────────────
// STEP 1: ĐỌC PREVIEW
// ─────────────────────────────────────────────

/**
 * Đọc sheet đầu tiên, lấy danh sách cột và giá trị mẫu tại startRow.
 * @param file    File XLSX
 * @param sheetIndex Index của sheet cần đọc (0-indexed, default 0)
 * @param startRow Hàng bắt đầu có dữ liệu (1-indexed, default 2)
 */
export async function readSheetPreview(
  file: File,
  sheetIndex = 0,
  startRow = 2,
): Promise<SheetPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[sheetIndex];
  if (!sheet) throw new Error("File Excel không có sheet dữ liệu.");

  // Xác định số cột thực tế từ dòng mẫu
  const sampleRow = sheet.getRow(startRow);
  const lastCol = sheet.columnCount || 26;

  const columns: SheetColumnInfo[] = [];
  for (let c = 1; c <= Math.min(lastCol, 52); c++) {
    const cell = sampleRow.getCell(c);
    const rawText = getCellText(cell);
    // Chỉ thêm cột nếu có giá trị hoặc là cột A-Z đầu tiên
    if (rawText || c <= 26) {
      columns.push({
        key: colIndexToLetter(c - 1),
        sampleValue: rawText,
      });
    }
  }

  // Đếm số hàng có dữ liệu từ startRow
  let totalDataRows = 0;
  sheet.eachRow((_, rowNum) => {
    if (rowNum >= startRow) totalDataRows++;
  });

  return {
    columns: columns.filter((col) => col.sampleValue !== "" || col.key <= "F"),
    sheetName: sheet.name,
    totalDataRows,
  };
}

// ─────────────────────────────────────────────
// STEP 2: PARSE TOÀN BỘ FILE
// ─────────────────────────────────────────────

/**
 * Lấy danh sách các sheet có trong file Excel.
 */
export async function getExcelSheets(file: File): Promise<ExcelSheetInfo[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  return workbook.worksheets.map((sheet, index) => ({
    index,
    name: sheet.name,
  }));
}

/**
 * Parse toàn bộ sheet theo mapping đã xác định, match với products catalog.
 */
export async function parseVoucherRows(
  file: File,
  sheetIndex: number,
  mapping: VoucherColumnMapping,
  startRow: number,
  products: Product[],
): Promise<VoucherItemParseResult[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[sheetIndex];
  if (!sheet) throw new Error("File Excel không có sheet dữ liệu.");

  // Build lookup maps cho products
  const bySkuNorm = new Map<string, Product>();
  const byNameNorm = new Map<string, Product>();
  for (const p of products) {
    if (p.code) bySkuNorm.set(normalizeStr(p.code), p);
    byNameNorm.set(normalizeStr(p.name), p);
  }

  const colToIndex = (key: string): number => {
    let result = 0;
    for (let i = 0; i < key.length; i++) {
      result = result * 26 + key.charCodeAt(i) - 64;
    }
    return result; // 1-indexed
  };

  const results: VoucherItemParseResult[] = [];

  sheet.eachRow((row, rowNum) => {
    if (rowNum < startRow) return;

    const getCol = (key: string | null): string => {
      if (!key) return "";
      return getCellText(row.getCell(colToIndex(key)));
    };

    const rawName = getCol(mapping.productName);
    const rawSku = getCol(mapping.sku);
    const rawQuantity = getCol(mapping.quantity);
    const rawUnitPrice = getCol(mapping.unitPrice);
    const rawNotes = getCol(mapping.notes);
    const rawLocation = getCol(mapping.location);

    // Bỏ qua dòng rỗng hoàn toàn
    if (!rawName.trim() && !rawSku.trim() && !rawQuantity.trim()) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Match product: ưu tiên SKU
    let matchedProduct: Product | null = null;
    if (rawSku.trim()) {
      matchedProduct = bySkuNorm.get(normalizeStr(rawSku)) ?? null;
      if (!matchedProduct) {
        errors.push(`SKU "${rawSku}" không tìm thấy trong catalog.`);
      }
    } else if (rawName.trim()) {
      matchedProduct = byNameNorm.get(normalizeStr(rawName)) ?? null;
      if (!matchedProduct) {
        errors.push(`Tên "${rawName}" không tìm thấy trong catalog.`);
      }
    }

    if (!rawName.trim() && !rawSku.trim()) {
      errors.push("Thiếu Tên sản phẩm hoặc SKU.");
    }

    // Parse quantity
    let parsedQuantity: number | null = null;
    if (rawQuantity.trim()) {
      const n = parseLocaleNumber(rawQuantity);
      if (isNaN(n) || n <= 0) {
        errors.push(`Số lượng "${rawQuantity}" không hợp lệ (phải > 0).`);
      } else {
        parsedQuantity = Math.round(n); // Số lượng phải là số nguyên
      }
    } else {
      errors.push("Thiếu Số lượng.");
    }

    // Parse unit price
    let parsedUnitPrice: number | null = null;
    if (rawUnitPrice.trim()) {
      const n = parseLocaleNumber(rawUnitPrice);
      if (!isNaN(n) && n >= 0) {
        // Làm tròn 2 số thập phân (2.142,66 → 2142.66)
        parsedUnitPrice = Math.round(n * 100) / 100;
      } else {
        warnings.push(`Đơn giá "${rawUnitPrice}" không hợp lệ, bỏ qua.`);
      }
    }

    // Duplicate check (cùng SKU trong file)
    const existingIdx = results.findIndex(
      (r) =>
        r.matchedProduct?.id === matchedProduct?.id && matchedProduct !== null,
    );
    if (existingIdx !== -1) {
      warnings.push(
        `Sản phẩm đã xuất hiện ở dòng ${results[existingIdx].rowNumber}.`,
      );
    }

    // Location: just pass the raw trimmed value; matching happens in CreateVoucherTab
    const parsedLocationCode = rawLocation.trim();

    results.push({
      rowNumber: rowNum,
      rawName,
      rawSku,
      rawQuantity,
      rawUnitPrice,
      rawNotes,
      rawLocation,
      parsedLocationCode,
      matchedProduct,
      parsedQuantity,
      parsedUnitPrice,
      errors,
      warnings,
    });
  });

  return results;
}

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────

export function summarizeVoucherResults(
  rows: VoucherItemParseResult[],
): VoucherItemParseStats {
  return {
    totalRows: rows.length,
    validRows: rows.filter((r) => r.errors.length === 0 && r.matchedProduct).length,
    errorRows: rows.filter((r) => r.errors.length > 0).length,
    warningRows: rows.filter((r) => r.warnings.length > 0 && r.errors.length === 0)
      .length,
  };
}
