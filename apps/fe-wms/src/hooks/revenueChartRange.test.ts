import assert from "node:assert/strict";
import test from "node:test";

import type { RevenueDashboardFilter } from "@bduck/shared-types";

import { buildRevenueChartRangeFilter } from "./revenueChartRange";

const filter: RevenueDashboardFilter = {
  mode: "date",
  date: "2026-08-31",
  month: "2026-08",
  year: "2026",
  startDate: "2026-08-31",
  endDate: "2026-08-31",
};

test("builds calendar week and month chart ranges around the selected date", () => {
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(filter, "week")),
    { startDate: "2026-08-31", endDate: "2026-09-06" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(filter, "month")),
    { startDate: "2026-08-01", endDate: "2026-08-31" },
  );
});

test("builds rolling seven and thirty day chart ranges ending on the selected date", () => {
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(filter, "last7")),
    { startDate: "2026-08-25", endDate: "2026-08-31" },
  );
  assert.deepEqual(
    pickRange(buildRevenueChartRangeFilter(filter, "last30")),
    { startDate: "2026-08-02", endDate: "2026-08-31" },
  );
});

function pickRange(value: RevenueDashboardFilter) {
  return { startDate: value.startDate, endDate: value.endDate };
}
