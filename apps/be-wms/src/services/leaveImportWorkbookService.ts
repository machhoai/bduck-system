import {
  LEAVE_IMPORT_MAX_ROWS,
  LEAVE_IMPORT_TEMPLATE_VERSION,
  LeaveDayPortion,
  LeaveImportRecordType,
  type LeaveImportNormalizedPayload,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import {
  buildLeaveImportReferenceMaps,
  resolveLeaveImportReference,
  type LeaveImportReferenceMaps,
} from "./leaveImportWorkbookReferences.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DATA_SHEET = "Leave_history";
const REFS_SHEET = "_refs";
const META_SHEET = "_meta";
const HEADERS = [
  "record_type",
  "source_reference",
  "employee_code",
  "posting_date",
  "leave_year",
  "units",
  "request_type",
  "request_status",
  "day_portion",
  "reason",
] as const;
type HeaderKey = (typeof HEADERS)[number];

export interface ParsedLeaveImportRow {
  row_number: number;
  record_type: string;
  source_reference: string;
  employee_code: string;
  normalized_payload: LeaveImportNormalizedPayload;
}

const workbookError = (vi: string, zh: string) => ({
  statusCode: 400,
  messages: { vi, zh },
});

const cellText = (cell: ExcelJS.Cell): string => {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
  }
  return String(value).trim();
};

const enumValue = <T extends string>(
  value: string,
  values: readonly T[],
): T | null => {
  const normalized = value.trim().toUpperCase();
  return values.includes(normalized as T) ? (normalized as T) : null;
};

const parseUnits = (value: string): number | null => {
  if (!value.trim()) return null;
  const units = Number(value.replace(",", "."));
  return Number.isFinite(units) ? units : null;
};

const parseRow = (
  row: ExcelJS.Row,
  rowNumber: number,
  columns: Map<HeaderKey, number>,
  references: LeaveImportReferenceMaps,
): ParsedLeaveImportRow | null => {
  const read = (key: HeaderKey) => cellText(row.getCell(columns.get(key) ?? 0));
  const values = Object.fromEntries(
    HEADERS.map((key) => [key, read(key)]),
  ) as Record<HeaderKey, string>;
  if (!Object.values(values).some(Boolean)) return null;

  const recordType = resolveLeaveImportReference(
    values.record_type,
    references.record_type,
  )
    .trim()
    .toUpperCase();
  const dayPortion = enumValue(
    resolveLeaveImportReference(values.day_portion, references.day_portion),
    Object.values(LeaveDayPortion),
  );
  const requestType = enumValue(
    resolveLeaveImportReference(values.request_type, references.request_type),
    Object.values(LeaveRequestType),
  );
  const requestStatus = enumValue(
    resolveLeaveImportReference(
      values.request_status,
      references.request_status,
    ),
    [
      LeaveRequestStatus.APPROVED,
      LeaveRequestStatus.REJECTED,
      LeaveRequestStatus.CANCELLED,
    ],
  );
  const units =
    recordType === LeaveImportRecordType.HISTORICAL_REQUEST && dayPortion
      ? dayPortion === LeaveDayPortion.FULL_DAY
        ? 1
        : 0.5
      : parseUnits(values.units);

  return {
    row_number: rowNumber,
    record_type: recordType,
    source_reference: values.source_reference.trim(),
    employee_code: resolveLeaveImportReference(
      values.employee_code,
      references.employee,
    )
      .trim()
      .toUpperCase(),
    normalized_payload: {
      posting_date: values.posting_date.trim(),
      leave_year: Number(
        resolveLeaveImportReference(values.leave_year, references.leave_year),
      ),
      units,
      request_type: requestType,
      request_status: requestStatus,
      day_portion: dayPortion,
      reason: values.reason.trim(),
    },
  };
};

const readMetadata = (sheet: ExcelJS.Worksheet) => {
  const metadata = new Map<string, string>();
  sheet.eachRow((row) => {
    const key = cellText(row.getCell(1));
    const value = cellText(row.getCell(2));
    if (key) metadata.set(key, value);
  });
  return metadata;
};

const findHeaderColumns = (sheet: ExcelJS.Worksheet) => {
  for (
    let rowNumber = 1;
    rowNumber <= Math.min(5, sheet.rowCount);
    rowNumber += 1
  ) {
    const columns = new Map<HeaderKey, number>();
    sheet.getRow(rowNumber).eachCell((cell, columnNumber) => {
      const header = cellText(cell) as HeaderKey;
      if (HEADERS.includes(header)) columns.set(header, columnNumber);
    });
    if (HEADERS.every((header) => columns.has(header))) {
      return { columns, rowNumber };
    }
  }
  return null;
};

const assertSafeSourceUrl = async (sourceUrl: string) => {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw workbookError("URL tệp nguồn không hợp lệ.", "源文件 URL 无效。");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "firebasestorage.googleapis.com" ||
    !url.pathname.startsWith("/v0/b/")
  ) {
    throw workbookError(
      "Tệp nguồn phải được tải từ Firebase Storage của hệ thống.",
      "源文件必须来自系统的 Firebase Storage。",
    );
  }
  const pathParts = url.pathname.split("/");
  const bucketName = decodeURIComponent(pathParts[3] ?? "");
  const objectPath = decodeURIComponent(pathParts.slice(5).join("/"));
  const { storage } = await import("../config/firebase.js");
  if (
    bucketName !== storage.bucket().name ||
    !objectPath.startsWith("leave-imports/")
  ) {
    throw workbookError(
      "Tệp nguồn không thuộc thư mục nhập lịch sử của hệ thống.",
      "源文件不属于系统的历史导入目录。",
    );
  }
};

const downloadWorkbook = async (
  sourceUrl: string,
  expectedChecksum: string,
): Promise<ArrayBuffer> => {
  await assertSafeSourceUrl(sourceUrl);
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw workbookError("Không thể tải tệp nguồn.", "无法下载源文件。");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_BYTES) {
    throw workbookError("Tệp Excel vượt quá 10MB.", "Excel 文件超过10MB。");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw workbookError("Tệp Excel vượt quá 10MB.", "Excel 文件超过10MB。");
  }
  const checksum = createHash("sha256").update(buffer).digest("hex");
  if (checksum !== expectedChecksum.toLowerCase()) {
    throw workbookError("Checksum của tệp không khớp.", "文件校验值不匹配。");
  }
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
};

export const parseLeaveImportWorkbookBuffer = async (
  buffer: ArrayBuffer,
): Promise<ParsedLeaveImportRow[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const metaSheet = workbook.getWorksheet(META_SHEET);
  const metadata = metaSheet ? readMetadata(metaSheet) : null;
  if (
    !metadata ||
    metadata.get("template_version") !== LEAVE_IMPORT_TEMPLATE_VERSION
  ) {
    throw workbookError(
      "Phiên bản tệp mẫu không được hỗ trợ.",
      "不支持该模板版本。",
    );
  }
  const dataSheetName = metadata.get("data_sheet_name") || DATA_SHEET;
  const sheet = workbook.getWorksheet(dataSheetName);
  if (!sheet) {
    throw workbookError(
      `Không tìm thấy sheet ${dataSheetName}.`,
      `找不到工作表 ${dataSheetName}。`,
    );
  }
  const header = findHeaderColumns(sheet);
  if (!header) {
    throw workbookError("Tệp mẫu thiếu cột bắt buộc.", "模板缺少必填列。");
  }
  const references = buildLeaveImportReferenceMaps(
    workbook.getWorksheet(REFS_SHEET),
    cellText,
  );
  const rows: ParsedLeaveImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const parsed = parseRow(row, rowNumber, header.columns, references);
    if (parsed) rows.push(parsed);
  });
  if (rows.length === 0 || rows.length > LEAVE_IMPORT_MAX_ROWS) {
    throw workbookError(
      `Tệp phải có từ 1 đến ${LEAVE_IMPORT_MAX_ROWS} dòng dữ liệu.`,
      `文件必须包含1至${LEAVE_IMPORT_MAX_ROWS}行数据。`,
    );
  }
  return rows;
};

export const parseLeaveImportWorkbook = async (input: {
  source_file_url: string;
  source_file_checksum: string;
}): Promise<ParsedLeaveImportRow[]> =>
  parseLeaveImportWorkbookBuffer(
    await downloadWorkbook(input.source_file_url, input.source_file_checksum),
  );
