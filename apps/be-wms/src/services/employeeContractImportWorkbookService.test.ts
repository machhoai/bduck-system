import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EmployeeContractType } from "@bduck/shared-types";
import ExcelJS from "exceljs";

import { parseEmployeeContractImportWorkbook } from "./employeeContractImportWorkbookService.js";

const templateUrl = new URL(
  "../../../fe-wms/public/templates/employee-contract-history-import-v1.xlsx",
  import.meta.url,
);

const workbookWithRow = async (values: ExcelJS.CellValue[]) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await readFile(templateUrl)) as unknown as ExcelJS.Buffer,
  );
  workbook.getWorksheet("Contracts")!.getRow(5).values = values;
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

test("parses the delivered template with DD-MM-YYYY dates", async () => {
  const buffer = await workbookWithRow([
    "NV001",
    "HD-2024-001",
    "FIXED_TERM",
    "01-01-2024",
    "31-12-2024",
    "TERMINATED",
    "30-06-2024",
    "Nghỉ việc",
    "HD-2024-001.pdf",
    "Dữ liệu cũ",
  ]);
  const rows = await parseEmployeeContractImportWorkbook(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employee_code, "NV001");
  assert.equal(rows[0].normalized_payload.contract_type, EmployeeContractType.FIXED_TERM);
  assert.equal(rows[0].normalized_payload.start_date, "2024-01-01");
  assert.equal(rows[0].normalized_payload.lifecycle_date, "2024-06-30");
  assert.deepEqual(rows[0].parse_messages, []);
});

test("reports a bilingual row error for an invalid date", async () => {
  const buffer = await workbookWithRow([
    "NV002",
    "HD-2024-002",
    "FIXED_TERM",
    "2024/01/01",
    "31-12-2024",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [row] = await parseEmployeeContractImportWorkbook(buffer);
  assert.equal(row.normalized_payload.start_date, "");
  assert.equal(row.parse_messages.length, 1);
  assert.match(row.parse_messages[0].vi, /DD-MM-YYYY/u);
  assert.match(row.parse_messages[0].zh, /DD-MM-YYYY/u);
});
