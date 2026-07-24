import {
  LeaveDayPortion,
  LeaveImportRecordType,
  type LeaveImportNormalizedPayload,
  type LeaveLedgerDelta,
  LeaveRequestStatus,
  LeaveRequestType,
  type LocalizedText,
} from "@bduck/shared-types";
import { createZeroLeaveDelta } from "./leaveBalancePolicy.js";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/u;
const SAFE_EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9._-]{1,50}$/u;
const UNSAFE_QUERY_PATTERN =
  /\$(?:where|ne|gt|gte|lt|lte|in|nin|or|and)\b/iu;

const message = (vi: string, zh: string): LocalizedText => ({ vi, zh });

export const isValidLeaveImportLocalDate = (value: string): boolean => {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const validateLeaveImportIdentity = (input: {
  source_reference: string;
  employee_code: string;
}): LocalizedText[] => {
  const errors: LocalizedText[] = [];
  if (!SAFE_REFERENCE_PATTERN.test(input.source_reference)) {
    errors.push(
      message(
        "Mã tham chiếu chỉ được chứa chữ, số và . _ : - (tối đa 100 ký tự).",
        "来源参考编号只能包含字母、数字及 . _ : -（最多100个字符）。",
      ),
    );
  }
  if (!SAFE_EMPLOYEE_CODE_PATTERN.test(input.employee_code)) {
    errors.push(
      message(
        "Mã nhân viên không hợp lệ.",
        "员工编号无效。",
      ),
    );
  }
  return errors;
};

const hasHalfUnitPrecision = (units: number): boolean =>
  Number.isFinite(units) && Number.isInteger(units * 2);

export const validateLeaveImportPayload = (
  recordType: LeaveImportRecordType,
  payload: LeaveImportNormalizedPayload,
): LocalizedText[] => {
  const errors: LocalizedText[] = [];
  if (!isValidLeaveImportLocalDate(payload.posting_date)) {
    errors.push(message("Ngày ghi nhận không hợp lệ.", "记账日期无效。"));
  }
  const postingYear = Number(payload.posting_date.slice(0, 4));
  if (
    !Number.isInteger(payload.leave_year) ||
    payload.leave_year < 2000 ||
    payload.leave_year > postingYear
  ) {
    errors.push(
      message(
        "Năm phép phải từ 2000 và không lớn hơn năm của ngày ghi nhận.",
        "假期年度必须不早于2000年且不得晚于记账日期所在年份。",
      ),
    );
  }
  if (
    !payload.reason.trim() ||
    payload.reason.length > 500 ||
    UNSAFE_QUERY_PATTERN.test(payload.reason)
  ) {
    errors.push(
      message(
        "Lý do là bắt buộc, tối đa 500 ký tự và không được chứa toán tử truy vấn.",
        "原因必填，最多500个字符，且不得包含查询操作符。",
      ),
    );
  }

  if (recordType === LeaveImportRecordType.HISTORICAL_REQUEST) {
    const expectedUnits =
      payload.day_portion === LeaveDayPortion.FULL_DAY ? 1 : 0.5;
    if (
      !payload.request_type ||
      !payload.day_portion ||
      ![
        LeaveRequestStatus.APPROVED,
        LeaveRequestStatus.REJECTED,
        LeaveRequestStatus.CANCELLED,
      ].includes(payload.request_status as LeaveRequestStatus) ||
      payload.units !== expectedUnits
    ) {
      errors.push(
        message(
          "Đơn lịch sử phải có loại nghỉ, trạng thái hoàn tất, thời lượng và số ngày phù hợp.",
          "历史休假必须包含休假类型、已完成状态、时段及匹配的天数。",
        ),
      );
    }
    return errors;
  }

  if (
    payload.request_type ||
    payload.request_status ||
    payload.day_portion
  ) {
    errors.push(
      message(
        "Các cột thông tin đơn nghỉ chỉ dùng cho HISTORICAL_REQUEST.",
        "休假申请字段仅适用于 HISTORICAL_REQUEST。",
      ),
    );
  }
  const units = payload.units;
  const validUnits =
    units !== null &&
    hasHalfUnitPrecision(units) &&
    (recordType === LeaveImportRecordType.ADJUSTMENT
      ? units !== 0 && Math.abs(units) <= 365
      : units > 0 && units <= 365);
  if (!validUnits) {
    errors.push(
      message(
        "Số ngày phải theo bước 0,5; khác 0 và không vượt quá 365.",
        "天数必须以0.5为步长、不得为0且不得超过365。",
      ),
    );
  }
  return errors;
};

export const buildLeaveImportDelta = (
  recordType: LeaveImportRecordType,
  payload: LeaveImportNormalizedPayload,
): LeaveLedgerDelta | null => {
  const units = payload.units ?? 0;
  const delta = createZeroLeaveDelta();
  if (recordType === LeaveImportRecordType.HISTORICAL_REQUEST) {
    if (
      payload.request_status !== LeaveRequestStatus.APPROVED ||
      payload.request_type !== LeaveRequestType.PAID_ANNUAL
    ) {
      return null;
    }
    delta.available_units = -units;
    delta.used_units = units;
    return delta;
  }
  if (recordType === LeaveImportRecordType.ACCRUAL) {
    delta.available_units = units;
  } else if (recordType === LeaveImportRecordType.USED) {
    delta.available_units = -units;
    delta.used_units = units;
  } else if (recordType === LeaveImportRecordType.EXPIRED) {
    delta.available_units = -units;
    delta.expired_units = units;
  } else {
    delta.available_units = units;
  }
  return delta;
};
