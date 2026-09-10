import type {
  RevenueDashboardFilter,
  RevenueDataSource,
} from "@bduck/shared-types";

import {
  comparisonFilterFromRange,
  compatibleComparisonMode,
  endOfMonth,
  formatDate,
  getPreviousComparisonRange,
  normalizeDate,
  normalizeRevenueRange,
  toDateInput,
} from "./revenueDashboardDateUtils";

export const DEFAULT_REVENUE_WAREHOUSE_ID =
  "2fa83576-277f-483e-8c52-2ec85b9a8cff";
const CACHE_VERSION = 3;

export type RevenueCompareMode =
  | "none"
  | "previous"
  | "date"
  | "month"
  | "year"
  | "custom";

export interface RevenueComparisonSelection {
  mode: RevenueCompareMode;
  date: string;
  month: string;
  year: string;
  startDate: string;
  endDate: string;
  dates: string[];
  months: string[];
  years: string[];
}

export function getDefaultRevenueFilter(): RevenueDashboardFilter {
  const date = toDateInput(new Date());
  return {
    mode: "date",
    date,
    month: date.slice(0, 7),
    year: date.slice(0, 4),
    startDate: date,
    endDate: date,
  };
}

export function getDefaultRevenueComparison(
  filter: RevenueDashboardFilter,
): RevenueComparisonSelection {
  const previous = getPreviousComparisonRange(filter);
  return {
    mode: "none",
    date: previous.endDate,
    month: previous.startDate.slice(0, 7),
    year: previous.startDate.slice(0, 4),
    startDate: previous.startDate,
    endDate: previous.endDate,
    dates: [],
    months: [],
    years: [],
  };
}

export function buildRevenueComparisonFilters(
  filter: RevenueDashboardFilter,
  comparison: RevenueComparisonSelection,
): RevenueDashboardFilter[] {
  const mode = compatibleComparisonMode(filter.mode, comparison.mode);
  if (mode === "none") return [];
  if (mode === "previous") {
    return [comparisonFilterFromRange(filter, getPreviousComparisonRange(filter))];
  }
  if (mode === "date") {
    const currentDate = normalizeRevenueRange(filter).endDate;
    return uniqueValues(comparison.dates.length ? comparison.dates : [comparison.date])
      .map(normalizeDate)
      .filter((date) => date !== currentDate)
      .map((date) => ({
        ...filter,
        mode: "date",
        date,
        month: date.slice(0, 7),
        year: date.slice(0, 4),
        startDate: date,
        endDate: date,
      }));
  }
  if (mode === "month") {
    const fallback = toDateInput(new Date()).slice(0, 7);
    const current = normalizeRevenueRange(filter).startDate.slice(0, 7);
    return uniqueValues(comparison.months.length ? comparison.months : [comparison.month])
      .map((month) => (/^\d{4}-\d{2}$/u.test(month) ? month : fallback))
      .filter((month) => month !== current)
      .map((month) => ({
        ...filter,
        mode: "month",
        date: `${month}-01`,
        month,
        year: month.slice(0, 4),
        startDate: `${month}-01`,
        endDate: endOfMonth(`${month}-01`),
      }));
  }
  if (mode === "year") {
    const fallback = toDateInput(new Date()).slice(0, 4);
    const current = normalizeRevenueRange(filter).startDate.slice(0, 4);
    return uniqueValues(comparison.years.length ? comparison.years : [comparison.year])
      .map((year) => (/^\d{4}$/u.test(year) ? year : fallback))
      .filter((year) => year !== current)
      .map((year) => ({
        ...filter,
        mode: "year",
        date: `${year}-01-01`,
        month: `${year}-01`,
        year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      }));
  }
  const first = normalizeDate(comparison.startDate);
  const second = normalizeDate(comparison.endDate || first);
  const range = first <= second
    ? { startDate: first, endDate: second }
    : { startDate: second, endDate: first };
  return [comparisonFilterFromRange({ ...filter, mode: "custom" }, range)];
}

export function buildRevenueComparisonFilter(
  filter: RevenueDashboardFilter,
  comparison: RevenueComparisonSelection,
): RevenueDashboardFilter | null {
  return buildRevenueComparisonFilters(filter, comparison)[0] ?? null;
}

export function getRevenueComparisonLabel(
  filter: RevenueDashboardFilter | null,
): string {
  if (!filter) return "";
  const range = normalizeRevenueRange(filter);
  if (range.startDate === range.endDate) {
    return `Ngày ${formatDate(range.startDate)}`;
  }
  if (
    range.startDate.endsWith("-01") &&
    range.endDate === endOfMonth(range.startDate)
  ) {
    return `Tháng ${range.startDate.slice(5, 7)}/${range.startDate.slice(0, 4)}`;
  }
  if (
    range.startDate.endsWith("-01-01") &&
    range.endDate.endsWith("-12-31")
  ) {
    return `Năm ${range.startDate.slice(0, 4)}`;
  }
  return `Từ ${formatDate(range.startDate)} đến ${formatDate(range.endDate)}`;
}

export function getRevenueComparisonLabels(
  filters: RevenueDashboardFilter[],
): string[] {
  return filters.map(getRevenueComparisonLabel);
}

export function buildRevenueDashboardQuery(
  filter: RevenueDashboardFilter,
  warehouseId = DEFAULT_REVENUE_WAREHOUSE_ID,
  source: RevenueDataSource = "OPEN_API",
): string {
  const query = new URLSearchParams({ mode: filter.mode, warehouseId, source });
  if (filter.mode === "date") query.set("date", filter.date);
  if (filter.mode === "month") query.set("month", filter.month);
  if (filter.mode === "year") query.set("year", filter.year);
  if (filter.mode === "custom") {
    query.set("startDate", filter.startDate);
    query.set("endDate", filter.endDate);
  }
  return query.toString();
}

export function getRevenueDashboardCacheKey(
  filter: RevenueDashboardFilter,
  warehouseId = DEFAULT_REVENUE_WAREHOUSE_ID,
  source: RevenueDataSource = "OPEN_API",
): string {
  const range = normalizeRevenueRange(filter);
  return [
    `v${CACHE_VERSION}`,
    source,
    warehouseId,
    filter.mode,
    range.startDate,
    range.endDate,
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/gu, "_");
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
