import type {
  RevenueDashboardFilter,
  RevenueDateMode,
} from "@bduck/shared-types";

import type { RevenueCompareMode } from "./revenueDashboardFilters";

export function comparisonFilterFromRange(
  filter: RevenueDashboardFilter,
  range: { startDate: string; endDate: string },
): RevenueDashboardFilter {
  if (filter.mode === "today" || filter.mode === "date") {
    return {
      ...filter,
      mode: "date",
      date: range.endDate,
      month: range.endDate.slice(0, 7),
      year: range.endDate.slice(0, 4),
      startDate: range.endDate,
      endDate: range.endDate,
    };
  }
  if (filter.mode === "month") {
    const month = range.startDate.slice(0, 7);
    return {
      ...filter,
      mode: "month",
      date: `${month}-01`,
      month,
      year: month.slice(0, 4),
      startDate: `${month}-01`,
      endDate: endOfMonth(`${month}-01`),
    };
  }
  if (filter.mode === "year") {
    const year = range.startDate.slice(0, 4);
    return {
      ...filter,
      mode: "year",
      date: `${year}-01-01`,
      month: `${year}-01`,
      year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }
  return {
    ...filter,
    mode: "custom",
    date: range.endDate,
    month: range.startDate.slice(0, 7),
    year: range.startDate.slice(0, 4),
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function normalizeRevenueRange(filter: RevenueDashboardFilter) {
  const today = toDateInput(new Date());
  if (filter.mode === "year") {
    const year = /^\d{4}$/u.test(filter.year) ? filter.year : today.slice(0, 4);
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (filter.mode === "month") {
    const month = /^\d{4}-\d{2}$/u.test(filter.month)
      ? filter.month
      : today.slice(0, 7);
    return { startDate: `${month}-01`, endDate: endOfMonth(`${month}-01`) };
  }
  if (filter.mode === "custom") {
    const first = normalizeDate(filter.startDate || today);
    const second = normalizeDate(filter.endDate || first);
    return first <= second
      ? { startDate: first, endDate: second }
      : { startDate: second, endDate: first };
  }
  const date = normalizeDate(filter.mode === "today" ? today : filter.date || today);
  return { startDate: date, endDate: date };
}

export function getPreviousComparisonRange(filter: RevenueDashboardFilter) {
  const range = normalizeRevenueRange(filter);
  if (filter.mode === "today" || filter.mode === "date") {
    const date = addDays(range.startDate, -1);
    return { startDate: date, endDate: date };
  }
  if (filter.mode === "month") {
    const month = addMonths(range.startDate, -1).slice(0, 7);
    return { startDate: `${month}-01`, endDate: endOfMonth(`${month}-01`) };
  }
  if (filter.mode === "year") {
    const year = Number(range.startDate.slice(0, 4)) - 1;
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  const length = diffDays(range.startDate, range.endDate) + 1;
  return {
    startDate: addDays(range.startDate, -length),
    endDate: addDays(range.startDate, -1),
  };
}

export function compatibleComparisonMode(
  current: RevenueDateMode,
  comparison: RevenueCompareMode,
): RevenueCompareMode {
  if (comparison === "none" || comparison === "previous") return comparison;
  if ((current === "today" || current === "date") && comparison === "date") {
    return comparison;
  }
  return current === comparison ? comparison : "previous";
}

export function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : toDateInput(new Date());
}

export function endOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return toDateInput(new Date(year, month, 0));
}

export function formatDate(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, amount: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return toDateInput(date);
}

function addMonths(value: string, amount: number) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + amount);
  return toDateInput(date);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function diffDays(startDate: string, endDate: string) {
  return Math.round(
    (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000,
  );
}
