import type { RevenueDashboardFilter } from "@bduck/shared-types";

import {
  endOfMonth,
  normalizeRevenueRange,
} from "./revenueDashboardDateUtils";

export const REVENUE_CHART_RANGES = [
  "week",
  "month",
  "last7",
  "last30",
] as const;

export type RevenueChartRange = (typeof REVENUE_CHART_RANGES)[number];

export function buildRevenueChartRangeFilter(
  filter: RevenueDashboardFilter,
  range: RevenueChartRange,
): RevenueDashboardFilter {
  const anchorDate = getRevenueChartAnchorDate(filter);
  let startDate = anchorDate;
  let endDate = anchorDate;

  if (range === "week") {
    startDate = startOfIsoWeek(anchorDate);
    endDate = addDays(startDate, 6);
  } else if (range === "month") {
    startDate = `${anchorDate.slice(0, 7)}-01`;
    endDate = endOfMonth(startDate);
  } else {
    startDate = addDays(anchorDate, range === "last7" ? -6 : -29);
  }

  return {
    ...filter,
    mode: "custom",
    date: anchorDate,
    month: anchorDate.slice(0, 7),
    year: anchorDate.slice(0, 4),
    startDate,
    endDate,
  };
}

export function getRevenueChartAnchorDate(filter: RevenueDashboardFilter) {
  return normalizeRevenueRange(filter).endDate;
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

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
