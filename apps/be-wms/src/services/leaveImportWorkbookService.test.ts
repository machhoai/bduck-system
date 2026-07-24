import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { parseLeaveImportWorkbookBuffer } from "./leaveImportWorkbookService.js";

const headers = [
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
];

const workbookBuffer = async (version = "1.0") => {
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet("Leave_history");
  data.addRow(headers);
  data.addRow([
    "HISTORICAL_REQUEST",
    "LEGACY-001",
    "nv001",
    "2026-01-12",
    2026,
    "",
    "PAID_ANNUAL",
    "APPROVED",
    "MORNING",
    "Dữ liệu lịch sử",
  ]);
  const meta = workbook.addWorksheet("_meta");
  meta.getCell("A1").value = "template_version";
  meta.getCell("B1").value = version;
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
};

const localizedWorkbookBuffer = async () => {
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet("Lich_su_nghi_phep");
  data.addRow([
    "Loại dữ liệu",
    "Mã tham chiếu nguồn",
    "Nhân viên",
    "Ngày ghi nhận",
    "Năm phép",
    "Số ngày",
    "Loại nghỉ",
    "Trạng thái đơn",
    "Thời lượng nghỉ",
    "Lý do",
  ]);
  data.addRow(headers);
  data.getRow(2).hidden = true;
  data.addRow([
    "Đơn nghỉ phép lịch sử",
    "LEGACY-LOCALIZED-001",
    "Nguyễn Văn An — NV002",
    "2026-02-10",
    "2026",
    "",
    "Nghỉ phép năm",
    "Đã duyệt",
    "Buổi chiều",
    "Dữ liệu bản địa hóa",
  ]);
  const refs = workbook.addWorksheet("_refs");
  const pairs = [
    ["record_type", "Đơn nghỉ phép lịch sử", "HISTORICAL_REQUEST"],
    ["request_type", "Nghỉ phép năm", "PAID_ANNUAL"],
    ["request_status", "Đã duyệt", "APPROVED"],
    ["day_portion", "Buổi chiều", "AFTERNOON"],
    ["employee", "Nguyễn Văn An — NV002", "NV002"],
    ["leave_year", "2026", "2026"],
  ];
  pairs.forEach(([key, optionLabel, code], index) => {
    const labelColumn = index * 2 + 1;
    refs.getCell(1, labelColumn).value = `${key}_label`;
    refs.getCell(1, labelColumn + 1).value = `${key}_code`;
    refs.getCell(2, labelColumn).value = optionLabel;
    refs.getCell(2, labelColumn + 1).value = code;
  });
  const meta = workbook.addWorksheet("_meta");
  meta.addRow(["template_version", "1.0"]);
  meta.addRow(["data_sheet_name", "Lich_su_nghi_phep"]);
  meta.addRow(["header_row", 2]);
  meta.addRow(["locale", "vi"]);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
};

test("parses the versioned leave import workbook on the server", async () => {
  const rows = await parseLeaveImportWorkbookBuffer(await workbookBuffer());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employee_code, "NV001");
  assert.equal(rows[0].normalized_payload.units, 0.5);
  assert.equal(rows[0].normalized_payload.posting_date, "2026-01-12");
});

test("maps localized dropdown labels and employee selection to technical codes", async () => {
  const rows = await parseLeaveImportWorkbookBuffer(
    await localizedWorkbookBuffer(),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].row_number, 3);
  assert.equal(rows[0].record_type, "HISTORICAL_REQUEST");
  assert.equal(rows[0].employee_code, "NV002");
  assert.equal(rows[0].normalized_payload.request_type, "PAID_ANNUAL");
  assert.equal(rows[0].normalized_payload.request_status, "APPROVED");
  assert.equal(rows[0].normalized_payload.day_portion, "AFTERNOON");
  assert.equal(rows[0].normalized_payload.units, 0.5);
});

test("rejects an unsupported leave import template version", async () => {
  await assert.rejects(
    async () => parseLeaveImportWorkbookBuffer(await workbookBuffer("0.9")),
    (error: { statusCode?: number }) => error.statusCode === 400,
  );
});
