import ExcelJS from "exceljs";
import {
  EXPENSE_IMPORT_COLUMN_KEYS,
  type ExpenseImportColumnKey,
  type ExpenseImportText,
} from "./expenseExcelTypes";

const BASE_HEADER_ALIASES: Record<string, ExpenseImportColumnKey> = {
  cost_center: "costCenter",
  costcenter: "costCenter",
  group: "costCenter",
  expense_group: "costCenter",
  nhom: "costCenter",
  nhom_chi_phi: "costCenter",
  bo_phan: "costCenter",
  item_code: "itemCode",
  code: "itemCode",
  category_code: "itemCode",
  ma_dong: "itemCode",
  ma_chi_phi: "itemCode",
  item_name: "itemName",
  name: "itemName",
  category: "itemName",
  expense_name: "itemName",
  ten_chi_phi: "itemName",
  ten_muc: "itemName",
  budget: "budgetAmount",
  budget_amount: "budgetAmount",
  ngan_sach: "budgetAmount",
  actual: "actualAmount",
  actual_amount: "actualAmount",
  thuc_chi: "actualAmount",
  so_tien: "actualAmount",
  note: "note",
  notes: "note",
  ghi_chu: "note",
};

export const emptyExpenseRawRow = (): Record<ExpenseImportColumnKey, string> => ({
  costCenter: "",
  itemCode: "",
  itemName: "",
  budgetAmount: "",
  actualAmount: "",
  note: "",
});

export const normalizeExpenseText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

export const normalizeExpenseKey = (value: unknown) =>
  normalizeExpenseText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");

export const normalizeExpenseIdentity = (value: unknown) =>
  normalizeExpenseKey(value).replace(/_/g, "");

export const extractExpenseOptionCode = (value: string) =>
  value.split(" - ")[0].trim();

export function getExcelCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (
      "richText" in value &&
      Array.isArray((value as ExcelJS.CellRichTextValue).richText)
    ) {
      return (value as ExcelJS.CellRichTextValue).richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("result" in value) {
      return String((value as ExcelJS.CellFormulaValue).result ?? "").trim();
    }
    if ("text" in value) {
      return String((value as ExcelJS.CellHyperlinkValue).text ?? "").trim();
    }
  }
  return cell.text.trim();
}

export function buildExpenseHeaderAliases(text: ExpenseImportText) {
  const aliases = { ...BASE_HEADER_ALIASES };
  for (const key of EXPENSE_IMPORT_COLUMN_KEYS) {
    const column = text.columns[key];
    aliases[
      normalizeExpenseKey(typeof column === "string" ? column : column.label)
    ] = key;
  }
  return aliases;
}

export function parseExpenseAmount(
  value: string,
  invalidMessage: string,
  negativeMessage: string,
): { value?: number; error?: string } {
  const text = value.trim();
  if (!text) return {};

  let numeric = text.replace(/[^\d,.\-]/g, "");
  const isNegative = numeric.startsWith("-");
  numeric = numeric.replace(/-/g, "");

  const commaCount = (numeric.match(/,/g) ?? []).length;
  const dotCount = (numeric.match(/\./g) ?? []).length;
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");

  if (commaCount > 0 && dotCount > 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    numeric = numeric
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (commaCount > 0) {
    numeric =
      commaCount === 1 && numeric.length - lastComma - 1 <= 2
        ? numeric.replace(",", ".")
        : numeric.replace(/,/g, "");
  } else if (dotCount > 1) {
    numeric = numeric.replace(/\./g, "");
  } else if (dotCount === 1 && numeric.length - lastDot - 1 === 3) {
    numeric = numeric.replace(".", "");
  }

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return { error: invalidMessage };
  if (isNegative || parsed < 0) return { error: negativeMessage };
  return { value: parsed };
}

export function normalizeExpenseRow(
  row: ExcelJS.Row,
  headers: Array<ExpenseImportColumnKey | null>,
) {
  const raw = emptyExpenseRawRow();
  headers.forEach((header, index) => {
    if (!header) return;
    raw[header] = getExcelCellText(row.getCell(index + 1));
  });
  return raw;
}
