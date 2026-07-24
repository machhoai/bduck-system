import {
  LEAVE_IMPORT_TEMPLATE_VERSION,
  type LeaveImportEmployeeOption,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";
import {
  addLeaveImportListValidation,
  addLeaveImportScalarValidations,
  fillLeaveImportGuide,
  styleLeaveImportDataSheet,
  writeLeaveImportReferencePair,
} from "./leaveImportTemplateFormatting";
import {
  buildLeaveImportTemplateOptions,
  getTemplateLabel,
} from "./leaveImportTemplateOptions";

export const LEAVE_IMPORT_REFS_SHEET = "_refs";
export const LEAVE_IMPORT_META_SHEET = "_meta";

export const buildLeaveImportTemplateWorkbook = (
  labels: Record<string, string>,
  employees: LeaveImportEmployeeOption[],
) => {
  if (employees.length === 0) {
    throw new Error("LEAVE_IMPORT_EMPLOYEES_EMPTY");
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "J-PULSE";
  workbook.created = new Date();
  workbook.modified = new Date();
  const options = buildLeaveImportTemplateOptions(labels, employees);
  const dataSheetName = getTemplateLabel(
    labels,
    "leaveImportDataSheetName",
    "Leave_history",
  );
  const guideSheetName = getTemplateLabel(
    labels,
    "leaveImportGuideSheetName",
    "Guide",
  );
  const dataSheet = workbook.addWorksheet(dataSheetName, {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
  });
  styleLeaveImportDataSheet(dataSheet, [
    labels.leaveImportColumnRecordType,
    labels.leaveImportColumnSourceReference,
    labels.leaveImportColumnEmployee,
    labels.leaveImportColumnPostingDate,
    labels.leaveImportColumnLeaveYear,
    labels.leaveImportColumnUnits,
    labels.leaveImportColumnRequestType,
    labels.leaveImportColumnRequestStatus,
    labels.leaveImportColumnDayPortion,
    labels.leaveImportColumnReason,
  ]);

  const refs = workbook.addWorksheet(LEAVE_IMPORT_REFS_SHEET);
  writeLeaveImportReferencePair(refs, 1, 2, "record_type", options.recordTypes);
  writeLeaveImportReferencePair(
    refs,
    3,
    4,
    "request_type",
    options.requestTypes,
  );
  writeLeaveImportReferencePair(
    refs,
    5,
    6,
    "request_status",
    options.requestStatuses,
  );
  writeLeaveImportReferencePair(refs, 7, 8, "day_portion", options.dayPortions);
  writeLeaveImportReferencePair(refs, 9, 10, "employee", options.employees);
  writeLeaveImportReferencePair(refs, 11, 12, "leave_year", options.years);

  addLeaveImportListValidation(
    dataSheet,
    "A",
    "A",
    options.recordTypes.length,
    labels,
    false,
  );
  addLeaveImportListValidation(
    dataSheet,
    "C",
    "I",
    options.employees.length,
    labels,
    false,
  );
  addLeaveImportListValidation(
    dataSheet,
    "E",
    "K",
    options.years.length,
    labels,
    false,
  );
  addLeaveImportListValidation(
    dataSheet,
    "G",
    "C",
    options.requestTypes.length,
    labels,
    true,
  );
  addLeaveImportListValidation(
    dataSheet,
    "H",
    "E",
    options.requestStatuses.length,
    labels,
    true,
  );
  addLeaveImportListValidation(
    dataSheet,
    "I",
    "G",
    options.dayPortions.length,
    labels,
    true,
  );
  addLeaveImportScalarValidations(dataSheet, labels);

  fillLeaveImportGuide(
    workbook.addWorksheet(guideSheetName),
    labels,
    options.recordTypes,
  );
  refs.state = "veryHidden";
  const meta = workbook.addWorksheet(LEAVE_IMPORT_META_SHEET);
  [
    ["template_version", LEAVE_IMPORT_TEMPLATE_VERSION],
    ["data_sheet_name", dataSheetName],
    ["header_row", 2],
    ["locale", labels.leaveImportLocale || "vi"],
  ].forEach(([key, value], index) => {
    meta.getCell(index + 1, 1).value = key;
    meta.getCell(index + 1, 2).value = value;
  });
  meta.state = "veryHidden";
  return workbook;
};
