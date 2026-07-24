import {
  LeaveDayPortion,
  LeaveImportRecordType,
  type LeaveImportEmployeeOption,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";

export const leaveImportTechnicalColumns = [
  ["record_type", 26],
  ["source_reference", 26],
  ["employee_code", 34],
  ["posting_date", 17],
  ["leave_year", 14],
  ["units", 14],
  ["request_type", 22],
  ["request_status", 20],
  ["day_portion", 18],
  ["reason", 48],
] as const;

export type LeaveImportTemplateOption = { label: string; code: string };

export const getTemplateLabel = (
  labels: Record<string, string>,
  key: string,
  fallback: string,
) => labels[key] || fallback;

const cleanText = (value: string) =>
  value.replace(/[\u0000-\u001F]/g, " ").trim();

export const buildLeaveImportTemplateOptions = (
  labels: Record<string, string>,
  employees: LeaveImportEmployeeOption[],
) => ({
  recordTypes: [
    {
      code: LeaveImportRecordType.HISTORICAL_REQUEST,
      label: getTemplateLabel(
        labels,
        "leaveImportTypeHistorical",
        LeaveImportRecordType.HISTORICAL_REQUEST,
      ),
    },
    {
      code: LeaveImportRecordType.ACCRUAL,
      label: getTemplateLabel(
        labels,
        "leaveImportTypeAccrual",
        LeaveImportRecordType.ACCRUAL,
      ),
    },
    {
      code: LeaveImportRecordType.USED,
      label: getTemplateLabel(
        labels,
        "leaveImportTypeUsed",
        LeaveImportRecordType.USED,
      ),
    },
    {
      code: LeaveImportRecordType.ADJUSTMENT,
      label: getTemplateLabel(
        labels,
        "leaveImportTypeAdjustment",
        LeaveImportRecordType.ADJUSTMENT,
      ),
    },
    {
      code: LeaveImportRecordType.EXPIRED,
      label: getTemplateLabel(
        labels,
        "leaveImportTypeExpired",
        LeaveImportRecordType.EXPIRED,
      ),
    },
  ],
  requestTypes: Object.values(LeaveRequestType).map((code) => ({
    code,
    label: getTemplateLabel(labels, `leaveType${code}`, code),
  })),
  requestStatuses: [
    LeaveRequestStatus.APPROVED,
    LeaveRequestStatus.REJECTED,
    LeaveRequestStatus.CANCELLED,
  ].map((code) => ({
    code,
    label: getTemplateLabel(labels, `leaveStatus${code}`, code),
  })),
  dayPortions: [
    { code: LeaveDayPortion.FULL_DAY, key: "fullDay" },
    { code: LeaveDayPortion.MORNING, key: "morning" },
    { code: LeaveDayPortion.AFTERNOON, key: "afternoon" },
  ].map(({ code, key }) => ({
    code,
    label: getTemplateLabel(labels, key, code),
  })),
  employees: [...employees]
    .sort(
      (left, right) =>
        left.full_name.localeCompare(
          right.full_name,
          labels.leaveImportLocale || "vi",
        ) || left.employee_code.localeCompare(right.employee_code),
    )
    .map((employee) => ({
      code: cleanText(employee.employee_code),
      label: `${cleanText(employee.full_name)} — ${cleanText(employee.employee_code)}`,
    })),
  years: Array.from({ length: 101 }, (_, index) => ({
    code: String(2000 + index),
    label: String(2000 + index),
  })),
});

export type LeaveImportTemplateOptions = ReturnType<
  typeof buildLeaveImportTemplateOptions
>;
