import type {
  RevenueChartGranularity,
  RevenueDashboardFilter,
  RevenueDateMode,
} from "@bduck/shared-types";

import { endOfMonth, normalizeRevenueRange } from "./revenueDashboardDateUtils";

export const REVENUE_CHART_RANGES = [
  "week",
  "month",
  "last7",
  "last30",
  "selectedMonth",
  "containingHalfYear",
  "last6Months",
  "selectedYear",
  "firstHalfYear",
  "secondHalfYear",
  "quarter1",
  "quarter2",
  "quarter3",
  "quarter4",
  "selectedRange",
] as const;

export type RevenueChartRange = (typeof REVENUE_CHART_RANGES)[number];

const DATE_RANGES: RevenueChartRange[] = ["last7", "week", "month", "last30"];
const MONTH_RANGES: RevenueChartRange[] = [
  "selectedMonth",
  "containingHalfYear",
  "last6Months",
  "selectedYear",
];
const YEAR_RANGES: RevenueChartRange[] = [
  "selectedYear",
  "firstHalfYear",
  "secondHalfYear",
  "quarter1",
  "quarter2",
  "quarter3",
  "quarter4",
];

export function getRevenueChartRangeOptions(
  mode: RevenueDateMode,
): RevenueChartRange[] {
  if (mode === "month") return MONTH_RANGES;
  if (mode === "year") return YEAR_RANGES;
  if (mode === "custom") return ["selectedRange"];
  return DATE_RANGES;
}

export function getDefaultRevenueChartRange(
  mode: RevenueDateMode,
): RevenueChartRange {
  if (mode === "month") return "selectedMonth";
  if (mode === "year") return "selectedYear";
  if (mode === "custom") return "selectedRange";
  return "last7";
}

export function normalizeRevenueChartRange(
  mode: RevenueDateMode,
  range: RevenueChartRange,
): RevenueChartRange {
  return getRevenueChartRangeOptions(mode).includes(range)
    ? range
    : getDefaultRevenueChartRange(mode);
}

export function getRevenueChartRangeAggregation(
  range: RevenueChartRange,
): RevenueChartGranularity | undefined {
  if (
    range === "containingHalfYear" ||
    range === "last6Months" ||
    range === "selectedYear" ||
    range === "firstHalfYear" ||
    range === "secondHalfYear" ||
    isQuarterRange(range)
  ) {
    return "month";
  }
  if (range === "selectedRange") return undefined;
  return "day";
}

export function buildRevenueChartRangeFilter(
  filter: RevenueDashboardFilter,
  requestedRange: RevenueChartRange,
): RevenueDashboardFilter {
  const range = normalizeRevenueChartRange(filter.mode, requestedRange);
  const anchorDate = getRevenueChartAnchorDate(filter);
  const selectedMonth = getSelectedMonth(filter);
  const selectedYear = getSelectedYear(filter);
  let startDate = anchorDate;
  let endDate = anchorDate;
  let mode: RevenueDateMode = "custom";

  if (range === "week") {
    startDate = startOfIsoWeek(anchorDate);
    endDate = addDays(startDate, 6);
  } else if (range === "month") {
    startDate = `${anchorDate.slice(0, 7)}-01`;
    endDate = endOfMonth(startDate);
    mode = "month";
  } else if (range === "last7" || range === "last30") {
    startDate = addDays(anchorDate, range === "last7" ? -6 : -29);
  } else if (range === "selectedMonth") {
    startDate = `${selectedMonth}-01`;
    endDate = endOfMonth(startDate);
    mode = "month";
  } else if (range === "containingHalfYear") {
    const startsInJanuary = Number(selectedMonth.slice(5, 7)) <= 6;
    startDate = `${selectedYear}-${startsInJanuary ? "01" : "07"}-01`;
    endDate = `${selectedYear}-${startsInJanuary ? "06-30" : "12-31"}`;
  } else if (range === "last6Months") {
    startDate = `${addMonths(`${selectedMonth}-01`, -5).slice(0, 7)}-01`;
    endDate = endOfMonth(`${selectedMonth}-01`);
  } else if (range === "selectedYear") {
    startDate = `${selectedYear}-01-01`;
    endDate = `${selectedYear}-12-31`;
    mode = "year";
  } else if (range === "firstHalfYear") {
    startDate = `${selectedYear}-01-01`;
    endDate = `${selectedYear}-06-30`;
  } else if (range === "secondHalfYear") {
    startDate = `${selectedYear}-07-01`;
    endDate = `${selectedYear}-12-31`;
  } else if (isQuarterRange(range)) {
    const quarter = Number(range.slice(-1));
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    startDate = `${selectedYear}-${String(startMonth).padStart(2, "0")}-01`;
    endDate = endOfMonth(
      `${selectedYear}-${String(endMonth).padStart(2, "0")}-01`,
    );
  } else {
    const normalized = normalizeRevenueRange(filter);
    startDate = normalized.startDate;
    endDate = normalized.endDate;
  }

  return {
    ...filter,
    mode,
    granularity: getRevenueChartRangeAggregation(range),
    date: anchorDate,
    month: selectedMonth,
    year: selectedYear,
    startDate,
    endDate,
  };
}

export function getRevenueChartAnchorDate(filter: RevenueDashboardFilter) {
  return normalizeRevenueRange(filter).endDate;
}

function getSelectedMonth(filter: RevenueDashboardFilter) {
  if (filter.mode === "month" && /^\d{4}-\d{2}$/u.test(filter.month)) {
    return filter.month;
  }
  return getRevenueChartAnchorDate(filter).slice(0, 7);
}

function getSelectedYear(filter: RevenueDashboardFilter) {
  if (filter.mode === "year" && /^\d{4}$/u.test(filter.year)) {
    return filter.year;
  }
  return getSelectedMonth(filter).slice(0, 4);
}

function isQuarterRange(
  range: RevenueChartRange,
): range is "quarter1" | "quarter2" | "quarter3" | "quarter4" {
  return /^quarter[1-4]$/u.test(range);
}

function startOfIsoWeek(value: string) {
  const date = parseDate(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return formatDate(date);
}

function addDays(value: string, amount: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return formatDate(date);
}

function addMonths(value: string, amount: number) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + amount);
  return formatDate(date);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
