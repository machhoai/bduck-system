import {
  EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS,
  EMPLOYEE_CONTRACT_IMPORT_TEMPLATE_VERSION,
  EmployeeContractImportLifecycleState,
  EmployeeContractType,
  isValidContractLocalDate,
  parseContractDisplayDate,
  type EmployeeContractImportNormalizedPayload,
  type LocalDate,
  type LocalizedText,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

const SHEET_NAME = "Contracts";
const HEADERS = [
  "employee_code",
  "contract_number",
  "contract_type",
  "start_date",
  "end_date",
  "lifecycle_state",
  "lifecycle_date",
  "lifecycle_reason",
  "pdf_file_name",
  "notes",
] as const;
type Header = (typeof HEADERS)[number];

export interface ParsedEmployeeContractImportRow {
  row_number: number;
  employee_code: string;
  source_reference: string;
  normalized_payload: EmployeeContractImportNormalizedPayload;
  parse_messages: LocalizedText[];
}

const message = (vi: string, zh: string): LocalizedText => ({ vi, zh });
const workbookError = (vi: string, zh: string) => ({
  code: "CONTRACT_IMPORT_WORKBOOK_INVALID",
  statusCode: 400,
  messages: message(vi, zh),
});

const cellText = (cell: ExcelJS.Cell): string => {
  const value = cell.value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return String(value.result ?? "").trim();
    if ("text" in value) return String(value.text ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
};

const parseDate = (cell: ExcelJS.Cell): LocalDate | null | "INVALID" => {
  if (cell.value == null || cell.value === "") return null;
  if (cell.value instanceof Date) {
    const year = cell.value.getUTCFullYear();
    const month = String(cell.value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cell.value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = cellText(cell);
  if (isValidContractLocalDate(text)) return text;
  return parseContractDisplayDate(text) ?? "INVALID";
};

const enumValue = <T extends string>(
  value: string,
  values: readonly T[],
): T | null => {
  const normalized = value.trim().toUpperCase();
  return values.includes(normalized as T) ? (normalized as T) : null;
};

const findHeaders = (sheet: ExcelJS.Worksheet) => {
  for (let rowNumber = 1; rowNumber <= Math.min(20, sheet.rowCount); rowNumber++) {
    const columns = new Map<Header, number>();
    sheet.getRow(rowNumber).eachCell((cell, column) => {
      const text = cellText(cell) as Header;
      if (HEADERS.includes(text)) columns.set(text, column);
    });
    if (HEADERS.every((header) => columns.has(header))) {
      return { rowNumber, columns };
    }
  }
  return null;
};

export const parseEmployeeContractImportWorkbook = async (
  buffer: Buffer,
): Promise<ParsedEmployeeContractImportRow[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw workbookError(
      `Không tìm thấy sheet "${SHEET_NAME}".`,
      `找不到工作表“${SHEET_NAME}”。`,
    );
  }
  if (
    cellText(sheet.getCell("A2")) !== "template_version" ||
    cellText(sheet.getCell("B2")) !== EMPLOYEE_CONTRACT_IMPORT_TEMPLATE_VERSION
  ) {
    throw workbookError(
      "Phiên bản template Excel không được hỗ trợ.",
      "Excel 模板版本不受支持。",
    );
  }
  const header = findHeaders(sheet);
  if (!header) {
    throw workbookError(
      "Thiếu hoặc sai tên cột bắt buộc trong template.",
      "模板中缺少必填列或列名错误。",
    );
  }
  const rows: ParsedEmployeeContractImportRow[] = [];
  for (
    let rowNumber = header.rowNumber + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const readCell = (key: Header) =>
      row.getCell(header.columns.get(key) ?? 0);
    const raw = Object.fromEntries(
      HEADERS.map((key) => [key, cellText(readCell(key))]),
    ) as Record<Header, string>;
    if (!Object.values(raw).some(Boolean)) continue;
    if (rows.length >= EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS) {
      throw workbookError(
        `Mỗi batch chỉ được tối đa ${EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS} dòng.`,
        `每批最多只能导入 ${EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS} 行。`,
      );
    }
    const messages: LocalizedText[] = [];
    const contractType = enumValue(raw.contract_type, Object.values(EmployeeContractType));
    const lifecycleState = enumValue(
      raw.lifecycle_state,
      Object.values(EmployeeContractImportLifecycleState),
    );
    const startDate = parseDate(readCell("start_date"));
    const endDate = parseDate(readCell("end_date"));
    const lifecycleDate = parseDate(readCell("lifecycle_date"));
    if (!raw.employee_code) {
      messages.push(message("Thiếu mã nhân viên.", "缺少员工编号。"));
    }
    if (!contractType) {
      messages.push(message("Loại hợp đồng không hợp lệ.", "合同类型无效。"));
    }
    if (raw.lifecycle_state && !lifecycleState) {
      messages.push(message("Trạng thái lịch sử không hợp lệ.", "历史状态无效。"));
    }
    if (startDate === "INVALID" || endDate === "INVALID" || lifecycleDate === "INVALID") {
      messages.push(
        message(
          "Ngày phải đúng định dạng DD-MM-YYYY.",
          "日期必须采用 DD-MM-YYYY 格式。",
        ),
      );
    }
    rows.push({
      row_number: rowNumber,
      employee_code: raw.employee_code.normalize("NFKC").trim().toUpperCase(),
      source_reference: `Contracts!${rowNumber}`,
      normalized_payload: {
        employee_code: raw.employee_code.normalize("NFKC").trim().toUpperCase(),
        contract_number: raw.contract_number.trim(),
        contract_type: contractType,
        start_date: startDate === "INVALID" || startDate === null ? "" : startDate,
        end_date: endDate === "INVALID" ? null : endDate,
        lifecycle_state: lifecycleState,
        lifecycle_date: lifecycleDate === "INVALID" ? null : lifecycleDate,
        lifecycle_reason: raw.lifecycle_reason.trim() || null,
        pdf_file_name: raw.pdf_file_name.trim() || null,
        notes: raw.notes.trim() || null,
      },
      parse_messages: messages,
    });
  }
  if (rows.length === 0) {
    throw workbookError("Template không có dòng dữ liệu.", "模板中没有数据行。");
  }
  return rows;
};
