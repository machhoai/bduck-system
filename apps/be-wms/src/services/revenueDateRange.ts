import type { RevenueDashboardFilter, RevenueDateMode } from "@bduck/shared-types";

export interface RevenueDateRange {
  startDate: string;
  endDate: string;
  label: string;
  highlightedDates: string[];
}

export interface RevenueDashboardQuery {
  mode: RevenueDateMode;
  date?: string;
  month?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function normalizeRevenueRange(
  input: RevenueDashboardQuery,
): RevenueDateRange {
  const today = vietnamToday();
  if (input.mode === "year") {
    const year = /^\d{4}$/u.test(input.year ?? "")
      ? input.year!
      : today.slice(0, 4);
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: year,
      highlightedDates: [],
    };
  }

  if (input.mode === "month") {
    const month = /^\d{4}-\d{2}$/u.test(input.month ?? "")
      ? input.month!
      : today.slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = endOfMonth(startDate);
    return {
      startDate,
      endDate,
      label: month,
      highlightedDates:
        today >= startDate && today <= endDate ? [today] : [],
    };
  }

  if (input.mode === "custom") {
    const first = normalizeDate(input.startDate, today);
    const second = normalizeDate(input.endDate, first);
    const startDate = first <= second ? first : second;
    const endDate = first <= second ? second : first;
    return {
      startDate,
      endDate,
      label: `${startDate} - ${endDate}`,
      highlightedDates: daysBetween(startDate, endDate),
    };
  }

  const date = normalizeDate(input.mode === "today" ? today : input.date, today);
  return {
    startDate: date,
    endDate: date,
    label: date,
    highlightedDates: [date],
  };
}

export function previousRevenueRange(
  input: RevenueDashboardQuery,
  range = normalizeRevenueRange(input),
): RevenueDateRange {
  if (input.mode === "today" || input.mode === "date") {
    const date = addDays(range.startDate, -1);
    return { startDate: date, endDate: date, label: date, highlightedDates: [] };
  }
  if (input.mode === "month") {
    const startDate = startOfMonth(addMonths(range.startDate, -1));
    return {
      startDate,
      endDate: endOfMonth(startDate),
      label: startDate.slice(0, 7),
      highlightedDates: [],
    };
  }
  if (input.mode === "year") {
    const year = String(Number(range.startDate.slice(0, 4)) - 1);
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: year,
      highlightedDates: [],
    };
  }

  const length = dayCount(range);
  const endDate = addDays(range.startDate, -1);
  const startDate = addDays(endDate, -(length - 1));
  return {
    startDate,
    endDate,
    label: `${startDate} - ${endDate}`,
    highlightedDates: [],
  };
}

export function assertRevenueExportRange(
  range: Pick<RevenueDateRange, "startDate" | "endDate">,
  maximumDays = 366,
): void {
  if (dayCount(range) <= maximumDays) return;
  throw {
    statusCode: 400,
    messages: {
      vi: `Phạm vi xuất dữ liệu không được vượt quá ${maximumDays} ngày.`,
      zh: `导出日期范围不能超过 ${maximumDays} 天。`,
    },
  };
}

export function dashboardFilterFromQuery(
  input: RevenueDashboardQuery,
): RevenueDashboardFilter {
  const range = normalizeRevenueRange(input);
  return {
    mode: input.mode,
    date: input.date ?? range.endDate,
    month: input.month ?? range.startDate.slice(0, 7),
    year: input.year ?? range.startDate.slice(0, 4),
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function daysBetween(startDate: string, endDate: string): string[] {
  const total = differenceInDays(startDate, endDate);
  return Array.from({ length: total + 1 }, (_, index) =>
    addDays(startDate, index),
  );
}

export function monthsBetween(startDate: string, endDate: string): string[] {
  const values: string[] = [];
  let cursor = startOfMonth(startDate);
  const last = startOfMonth(endDate);
  while (cursor <= last) {
    values.push(cursor.slice(0, 7));
    cursor = startOfMonth(addMonths(cursor, 1));
  }
  return values;
}

export function toVietnamIsoRange(range: {
  startDate: string;
  endDate: string;
}): { startIso: string; endExclusiveIso: string } {
  const start = new Date(`${range.startDate}T00:00:00+07:00`);
  const end = new Date(`${range.endDate}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endExclusiveIso: end.toISOString() };
}

export function endOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return formatUtcDate(new Date(Date.UTC(year, month, 0)));
}

function dayCount(range: { startDate: string; endDate: string }): number {
  return differenceInDays(range.startDate, range.endDate) + 1;
}

function differenceInDays(startDate: string, endDate: string): number {
  return Math.round(
    (parseUtcDate(endDate).getTime() - parseUtcDate(startDate).getTime()) /
      86_400_000,
  );
}

function addDays(value: string, amount: number): string {
  const date = parseUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatUtcDate(date);
}

function addMonths(value: string, amount: number): string {
  const date = parseUtcDate(value);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return formatUtcDate(date);
}

function startOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function normalizeDate(value: string | undefined, fallback: string): string {
  return value && DATE_PATTERN.test(value) ? value : fallback;
}

function parseUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function vietnamToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
