import {
  LEAVE_ACCRUAL_DAY_OF_MONTH,
  LEAVE_MAX_CALENDAR_GAP_DAYS,
  LEAVE_MAX_GAP_OCCURRENCES,
  LeaveDayPortion,
  type LeaveRequestDay,
  type LeaveRequestDaySelection,
  type LocalDate,
  type LocalizedText,
} from "@bduck/shared-types";

export type LeaveDateSelectionIssueCode =
  | "LEAVE_DATES_REQUIRED"
  | "LEAVE_DATE_INVALID"
  | "LEAVE_DAY_PORTION_INVALID"
  | "LEAVE_DATE_DUPLICATE"
  | "LEAVE_DATE_WEEKEND"
  | "LEAVE_DATE_HOLIDAY"
  | "LEAVE_DATE_GAP_TOO_WIDE"
  | "LEAVE_DATE_TOO_MANY_GAPS";

export interface LeaveDateSelectionIssue {
  code: LeaveDateSelectionIssueCode;
  messages: LocalizedText;
  date?: string;
}

export interface LeaveDateSelectionResult {
  valid: boolean;
  normalized_days: LeaveRequestDay[];
  total_units: number;
  issues: LeaveDateSelectionIssue[];
}

export type MonthlyLeaveAccrualClassification =
  | "INVALID_DATE"
  | "NOT_DUE"
  | "NOT_EMPLOYED"
  | "PENDING_PROBATION"
  | "AVAILABLE";

const ISSUE_MESSAGES: Record<LeaveDateSelectionIssueCode, LocalizedText> = {
  LEAVE_DATES_REQUIRED: {
    vi: "Vui lòng chọn ít nhất một ngày nghỉ.",
    zh: "请至少选择一个休假日期。",
  },
  LEAVE_DATE_INVALID: {
    vi: "Ngày nghỉ không hợp lệ. Định dạng bắt buộc là YYYY-MM-DD.",
    zh: "休假日期无效，必须使用 YYYY-MM-DD 格式。",
  },
  LEAVE_DAY_PORTION_INVALID: {
    vi: "Buổi nghỉ không hợp lệ. Vui lòng chọn cả ngày, buổi sáng hoặc buổi chiều.",
    zh: "休假时段无效，请选择全天、上午或下午。",
  },
  LEAVE_DATE_DUPLICATE: {
    vi: "Một ngày nghỉ không được chọn nhiều lần trong cùng yêu cầu.",
    zh: "同一休假日期不能在一份申请中重复选择。",
  },
  LEAVE_DATE_WEEKEND: {
    vi: "Không thể chọn ngày cuối tuần.",
    zh: "不能选择周末日期。",
  },
  LEAVE_DATE_HOLIDAY: {
    vi: "Không thể chọn ngày lễ của công ty.",
    zh: "不能选择公司的节假日。",
  },
  LEAVE_DATE_GAP_TOO_WIDE: {
    vi: "Khoảng cách giữa hai ngày nghỉ liền kề không được lớn hơn 2 ngày.",
    zh: "相邻两个休假日期之间的间隔不能超过 2 天。",
  },
  LEAVE_DATE_TOO_MANY_GAPS: {
    vi: "Mỗi yêu cầu chỉ được có tối đa một khoảng ngắt giữa các ngày nghỉ.",
    zh: "每份休假申请最多只能有一个日期间隔。",
  },
};

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

const parseLocalDateDayIndex = (value: string): number | null => {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(timestamp / MILLISECONDS_PER_DAY);
};

const PORTION_UNITS: Record<LeaveDayPortion, 0.5 | 1> = {
  [LeaveDayPortion.FULL_DAY]: 1,
  [LeaveDayPortion.MORNING]: 0.5,
  [LeaveDayPortion.AFTERNOON]: 0.5,
};

const createIssue = (
  code: LeaveDateSelectionIssueCode,
  date?: string,
): LeaveDateSelectionIssue => ({
  code,
  messages: ISSUE_MESSAGES[code],
  ...(date ? { date } : {}),
});

export const evaluateLeaveDateSelection = (
  selections: readonly LeaveRequestDaySelection[],
  options: {
    holiday_dates?: ReadonlySet<string>;
    weekend_day_indexes?: ReadonlySet<number>;
  } = {},
): LeaveDateSelectionResult => {
  const issues: LeaveDateSelectionIssue[] = [];
  const holidayDates = options.holiday_dates ?? new Set<string>();
  const weekendDayIndexes =
    options.weekend_day_indexes ?? new Set<number>([0, 6]);

  if (selections.length === 0) {
    issues.push(createIssue("LEAVE_DATES_REQUIRED"));
  }

  const seenDates = new Set<string>();
  const validSelections: Array<{
    dayIndex: number;
    selection: LeaveRequestDaySelection;
  }> = [];

  selections.forEach((selection) => {
    const dayIndex = parseLocalDateDayIndex(selection.date);
    if (dayIndex === null) {
      issues.push(createIssue("LEAVE_DATE_INVALID", selection.date));
      return;
    }
    if (seenDates.has(selection.date)) {
      issues.push(createIssue("LEAVE_DATE_DUPLICATE", selection.date));
      return;
    }
    seenDates.add(selection.date);

    if (!(selection.portion in PORTION_UNITS)) {
      issues.push(createIssue("LEAVE_DAY_PORTION_INVALID", selection.date));
      return;
    }

    const dayOfWeek = new Date(dayIndex * MILLISECONDS_PER_DAY).getUTCDay();
    if (weekendDayIndexes.has(dayOfWeek)) {
      issues.push(createIssue("LEAVE_DATE_WEEKEND", selection.date));
    }
    if (holidayDates.has(selection.date)) {
      issues.push(createIssue("LEAVE_DATE_HOLIDAY", selection.date));
    }

    validSelections.push({ dayIndex, selection });
  });

  validSelections.sort((left, right) => left.dayIndex - right.dayIndex);

  let gapOccurrences = 0;
  for (let index = 1; index < validSelections.length; index += 1) {
    const difference =
      validSelections[index].dayIndex - validSelections[index - 1].dayIndex;
    if (difference > LEAVE_MAX_CALENDAR_GAP_DAYS) {
      issues.push(
        createIssue(
          "LEAVE_DATE_GAP_TOO_WIDE",
          validSelections[index].selection.date,
        ),
      );
    }
    if (difference > 1) gapOccurrences += 1;
  }

  if (gapOccurrences > LEAVE_MAX_GAP_OCCURRENCES) {
    issues.push(createIssue("LEAVE_DATE_TOO_MANY_GAPS"));
  }

  const normalizedDays = validSelections.map(({ selection }) => ({
    ...selection,
    units: PORTION_UNITS[selection.portion],
  }));

  return {
    valid: issues.length === 0,
    normalized_days: normalizedDays,
    total_units: normalizedDays.reduce((sum, day) => sum + day.units, 0),
    issues,
  };
};

export const classifyMonthlyLeaveAccrual = (input: {
  posting_date: LocalDate;
  probation_start_date: LocalDate | null;
  official_start_date: LocalDate | null;
  resignation_date: LocalDate | null;
}): MonthlyLeaveAccrualClassification => {
  const postingDayIndex = parseLocalDateDayIndex(input.posting_date);
  if (postingDayIndex === null) return "INVALID_DATE";

  const postingDay = Number(input.posting_date.slice(8, 10));
  if (postingDay !== LEAVE_ACCRUAL_DAY_OF_MONTH) return "NOT_DUE";

  const employmentStartDate =
    input.probation_start_date ?? input.official_start_date;
  if (!employmentStartDate) return "NOT_EMPLOYED";

  const employmentStartDayIndex = parseLocalDateDayIndex(employmentStartDate);
  const resignationDayIndex = input.resignation_date
    ? parseLocalDateDayIndex(input.resignation_date)
    : null;
  const officialStartDayIndex = input.official_start_date
    ? parseLocalDateDayIndex(input.official_start_date)
    : null;

  if (
    employmentStartDayIndex === null ||
    (input.resignation_date !== null && resignationDayIndex === null) ||
    (input.official_start_date !== null && officialStartDayIndex === null)
  ) {
    return "INVALID_DATE";
  }

  if (
    employmentStartDayIndex > postingDayIndex ||
    (resignationDayIndex !== null && resignationDayIndex <= postingDayIndex)
  ) {
    return "NOT_EMPLOYED";
  }

  return officialStartDayIndex !== null &&
    officialStartDayIndex <= postingDayIndex
    ? "AVAILABLE"
    : "PENDING_PROBATION";
};

export const getLeaveCarryoverExpiryDate = (leaveYear: number): LocalDate =>
  `${leaveYear + 1}-03-31`;
