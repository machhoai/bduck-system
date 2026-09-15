import assert from "node:assert/strict";
import test from "node:test";

import type { RevenueDashboardFilter } from "@bduck/shared-types";

import {
  buildRevenueChartRangeFilter,
  getDefaultRevenueChartRange,
  getRevenueChartRangeAggregation,
  getRevenueChartRangeOptions,
} from "./revenueChartRange";

const filter: RevenueDashboardFilter = {
  mode: "date",
  date: "2026-08-31",
  month: "2026-08",
  year: "2026",
  startDate: "2026-08-31",
  endDate: "2026-08-31",
};

test("builds calendar week and month chart ranges around the selected date", () => {
  assert.deepEqual(pickRange(buildRevenueChartRangeFilter(filter, "week")), {
    startDate: "2026-08-31",
    endDate: "2026-09-06",
  });
  assert.deepEqual(pickRange(buildRevenueChartRangeFilter(filter, "month")), {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });
});

test("builds rolling seven and thirty day chart ranges ending on the selected date", () => {
  assert.deepEqual(pickRange(buildRevenueChartRangeFilter(filter, "last7")), {
    startDate: "2026-08-25",
    endDate: "2026-08-31",
  });
  assert.deepEqual(pickRange(buildRevenueChartRangeFilter(filter, "last30")), {
    startDate: "2026-08-02",
    endDate: "2026-08-31",
  });
});

test("offers mode-specific defaults and chart range options", () => {
  assert.equal(getDefaultRevenueChartRange("date"), "last7");
  assert.equal(getDefaultRevenueChartRange("month"), "selectedMonth");
  assert.equal(getDefaultRevenueChartRange("year"), "selectedYear");
  assert.equal(getDefaultRevenueChartRange("custom"), "selectedRange");
  assert.deepEqual(getRevenueChartRangeOptions("month"), [
    "selectedMonth",
    "containingHalfYear",
    "last6Months",
    "selectedYear",
  ]);
  assert.deepEqual(getRevenueChartRangeOptions("year"), [
    "selectedYear",
    "firstHalfYear",
    "secondHalfYear",
    "quarter1",
    "quarter2",
    "quarter3",
    "quarter4",
  ]);
});

test("builds selected month, containing half-year, rolling six months, and year", () => {
  const monthFilter = { ...filter, mode: "month" as const, month: "2026-08" };

  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(monthFilter, "selectedMonth")),
    { startDate: "2026-08-01", endDate: "2026-08-31" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(monthFilter, "containingHalfYear")),
    { startDate: "2026-07-01", endDate: "2026-12-31" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(monthFilter, "last6Months")),
    { startDate: "2026-03-01", endDate: "2026-08-31" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(monthFilter, "selectedYear")),
    { startDate: "2026-01-01", endDate: "2026-12-31" },
  );
  assert.equal(getRevenueChartRangeAggregation("selectedMonth"), "day");
  assert.equal(getRevenueChartRangeAggregation("last6Months"), "month");
});

test("builds first half, second half, and quarter ranges for a selected year", () => {
  const yearFilter = { ...filter, mode: "year" as const, year: "2026" };

  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(yearFilter, "firstHalfYear")),
    { startDate: "2026-01-01", endDate: "2026-06-30" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(yearFilter, "secondHalfYear")),
    { startDate: "2026-07-01", endDate: "2026-12-31" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(yearFilter, "quarter2")),
    { startDate: "2026-04-01", endDate: "2026-06-30" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(yearFilter, "quarter4")),
    { startDate: "2026-10-01", endDate: "2026-12-31" },
  );
});

test("falls back to a valid preset when a mode receives a stale range", () => {
  const monthFilter = { ...filter, mode: "month" as const, month: "2026-02" };
  const result = buildRevenueChartRangeFilter(monthFilter, "last7");

  assert.equal(result.mode, "month");
  assert.deepEqual(pickRange(result), {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
  });
});

function pickRange(value: RevenueDashboardFilter) {
  return { startDate: value.startDate, endDate: value.endDate };
}
