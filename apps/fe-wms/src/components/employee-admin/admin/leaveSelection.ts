import {
  LEAVE_MAX_CALENDAR_GAP_DAYS,
  LEAVE_MAX_GAP_OCCURRENCES,
  LeaveDayPortion,
  type LeaveRequestDaySelection,
} from "@bduck/shared-types";

const DAY_MS = 86_400_000;

const dayIndex = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};

export const createEmptyLeaveDay = (): LeaveRequestDaySelection => ({
  date: "",
  portion: LeaveDayPortion.FULL_DAY,
});

export const getLeaveSelectionIssue = (
  selections: readonly LeaveRequestDaySelection[],
  holidayDates: ReadonlySet<string>,
): string | null => {
  if (!selections.length || selections.some((item) => !item.date)) {
    return "selectAtLeastOneDate";
  }
  const dates = selections.map((item) => item.date);
  if (new Set(dates).size !== dates.length) return "duplicateLeaveDate";
  for (const date of dates) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) return "weekendNotAllowed";
    if (holidayDates.has(date)) return "holidayNotAllowed";
  }
  const indexes = dates.map(dayIndex).sort((a, b) => a - b);
  let gapCount = 0;
  for (let index = 1; index < indexes.length; index += 1) {
    const difference = indexes[index] - indexes[index - 1];
    if (difference > LEAVE_MAX_CALENDAR_GAP_DAYS) return "gapTooWide";
    if (difference > 1) gapCount += 1;
  }
  if (gapCount > LEAVE_MAX_GAP_OCCURRENCES) return "tooManyGaps";
  return null;
};

export const getSelectedLeaveUnits = (
  selections: readonly LeaveRequestDaySelection[],
) =>
  selections.reduce(
    (total, item) =>
      total +
      (item.date
        ? item.portion === LeaveDayPortion.FULL_DAY
          ? 1
          : 0.5
        : 0),
    0,
  );
