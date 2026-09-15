import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRevenueComparisonFilter,
  buildRevenueComparisonFilters,
  buildRevenueDashboardQuery,
  getDefaultRevenueComparison,
  getRevenueDashboardCacheKey,
  type RevenueComparisonSelection,
} from "./revenueDashboardFilters.js";

const filter = {
  mode: "custom" as const,
  date: "2026-08-10",
  month: "2026-08",
  year: "2026",
  startDate: "2026-08-01",
  endDate: "2026-08-10",
};

test("comparison filters normalize a reversed custom range", () => {
  const comparison: RevenueComparisonSelection = {
    mode: "custom",
    date: "2026-07-10",
    month: "2026-07",
    year: "2026",
    startDate: "2026-07-10",
    endDate: "2026-07-01",
    dates: [],
    months: [],
    years: [],
  };
  const [result] = buildRevenueComparisonFilters(filter, comparison);
  assert.equal(result?.startDate, "2026-07-01");
  assert.equal(result?.endDate, "2026-07-10");
});

test("previous comparison follows the selected day, month and year", () => {
  const cases = [
    {
      current: { ...filter, mode: "date" as const, date: "2026-08-10" },
      expected: { startDate: "2026-08-09", endDate: "2026-08-09" },
    },
    {
      current: { ...filter, mode: "month" as const, month: "2026-08" },
      expected: { startDate: "2026-07-01", endDate: "2026-07-31" },
    },
    {
      current: { ...filter, mode: "year" as const, year: "2026" },
      expected: { startDate: "2025-01-01", endDate: "2025-12-31" },
    },
  ];

  for (const { current, expected } of cases) {
    const result = buildRevenueComparisonFilter(current, {
      ...getDefaultRevenueComparison(current),
      mode: "previous",
    });
    assert.equal(result?.startDate, expected.startDate);
    assert.equal(result?.endDate, expected.endDate);
  }
});

test("dashboard query includes the selected data source and range", () => {
  const query = new URLSearchParams(
    buildRevenueDashboardQuery(filter, "store-1", "LOCAL_POS"),
  );
  assert.equal(query.get("source"), "LOCAL_POS");
  assert.equal(query.get("startDate"), "2026-08-01");
  assert.equal(query.get("endDate"), "2026-08-10");
});

test("cache key partitions OpenAPI and local dashboard data", () => {
  const openApi = getRevenueDashboardCacheKey(filter, "store-1", "OPEN_API");
  const local = getRevenueDashboardCacheKey(filter, "store-1", "LOCAL_POS");
  assert.notEqual(openApi, local);
  assert.match(openApi, /^v3_OPEN_API_store-1_custom_day_/u);
});
