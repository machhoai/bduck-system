const DEFAULT_HISTORY_START_DATE = "2025-12-10";
const OVERLAP_DAYS = 3;

export const addCalendarDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const resolvePartnerSyncStartDate = (
  lastSuccessfulEndDate: string | null | undefined,
): string =>
  lastSuccessfulEndDate
    ? addCalendarDays(lastSuccessfulEndDate, -OVERLAP_DAYS)
    : DEFAULT_HISTORY_START_DATE;
