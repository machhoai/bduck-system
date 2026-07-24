import assert from "node:assert/strict";
import test from "node:test";
import zh from "../lib/i18n/zh";
import { buildLeaveImportTemplateWorkbook } from "./leaveImportTemplateWorkbook";

const baseLabels: Record<string, string> = {
  leaveImportLocale: "vi",
  leaveImportDataSheetName: "Lich_su_nghi_phep",
  leaveImportGuideSheetName: "Huong_dan",
  leaveImportColumnRecordType: "Loại dữ liệu",
  leaveImportColumnSourceReference: "Mã tham chiếu nguồn",
  leaveImportColumnEmployee: "Nhân viên",
  leaveImportColumnPostingDate: "Ngày ghi nhận",
  leaveImportColumnLeaveYear: "Năm phép",
  leaveImportColumnUnits: "Số ngày",
  leaveImportColumnRequestType: "Loại nghỉ",
  leaveImportColumnRequestStatus: "Trạng thái đơn",
  leaveImportColumnDayPortion: "Thời lượng nghỉ",
  leaveImportColumnReason: "Lý do",
  leaveImportTypeHistorical: "Đơn nghỉ phép lịch sử",
  leaveImportTypeAccrual: "Cộng ngày phép lịch sử",
  leaveImportTypeUsed: "Ngày phép đã sử dụng",
  leaveImportTypeAdjustment: "Điều chỉnh số dư",
  leaveImportTypeExpired: "Ngày phép đã hết hạn",
  leaveTypePAID_ANNUAL: "Nghỉ phép năm",
  leaveTypeUNPAID: "Nghỉ không lương",
  leaveTypeSICK: "Nghỉ bệnh",
  leaveTypeMATERNITY: "Nghỉ thai sản",
  leaveStatusAPPROVED: "Đã duyệt",
  leaveStatusREJECTED: "Từ chối",
  leaveStatusCANCELLED: "Đã hủy",
  fullDay: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  leaveImportGuideTitle: "Hướng dẫn",
  leaveImportGuideVersion: "Phiên bản 1.0",
  leaveImportGuideEmployee: "Chọn nhân viên",
  leaveImportGuideSelections: "Chọn từ danh sách",
  leaveImportGuideReference: "Mã tham chiếu duy nhất",
  leaveImportGuideOrdering: "Nhập theo thứ tự",
  leaveImportGuideHistorical: "Quy tắc đơn lịch sử",
  leaveImportGuideLedger: "Quy tắc bút toán",
  leaveImportGuideMeaning: "Ý nghĩa",
  leaveImportGuideCode: "Mã",
  leaveImportGuideDescription: "Cách sử dụng",
};

const employees = [
  {
    id: "profile-2",
    employee_code: "NV002",
    full_name: "Trần Bình",
    workplace_warehouse_id: "warehouse-1",
  },
  {
    id: "profile-1",
    employee_code: "NV001",
    full_name: "Nguyễn An",
    workplace_warehouse_id: "warehouse-1",
  },
];

test("builds a localized template with employee and enum dropdowns", async () => {
  const workbook = buildLeaveImportTemplateWorkbook(baseLabels, employees);
  const data = workbook.getWorksheet("Lich_su_nghi_phep");
  const refs = workbook.getWorksheet("_refs");
  const meta = workbook.getWorksheet("_meta");
  assert.ok(data);
  assert.ok(refs);
  assert.ok(meta);
  assert.equal(data.getCell("A1").value, "Loại dữ liệu");
  assert.equal(data.getCell("C1").value, "Nhân viên");
  assert.equal(data.getCell("A2").value, "record_type");
  assert.equal(data.getRow(2).hidden, true);
  assert.equal(refs.getCell("I2").value, "Nguyễn An — NV001");
  assert.equal(refs.getCell("J2").value, "NV001");
  assert.equal(refs.state, "veryHidden");
  assert.equal(meta.getCell("B2").value, "Lich_su_nghi_phep");
  assert.match(
    String(data.getCell("C3").dataValidation.formulae?.[0]),
    /\$I\$2:\$I\$3/,
  );
  assert.match(
    String(data.getCell("G3").dataValidation.formulae?.[0]),
    /\$C\$2:\$C\$5/,
  );
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 10_000);
});

test("uses the selected Chinese workbook language", () => {
  const workbook = buildLeaveImportTemplateWorkbook(
    (zh as unknown as { employeeAdmin: Record<string, string> }).employeeAdmin,
    employees,
  );
  assert.equal(workbook.getWorksheet("休假历史")?.getCell("C1").value, "员工");
  assert.ok(workbook.getWorksheet("使用说明"));
  assert.equal(
    workbook.getWorksheet("_refs")?.getCell("A2").value,
    "历史休假申请",
  );
});

test("does not create a template without accessible employees", () => {
  assert.throws(
    () => buildLeaveImportTemplateWorkbook(baseLabels, []),
    /LEAVE_IMPORT_EMPLOYEES_EMPTY/,
  );
});
