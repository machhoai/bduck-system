import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRevenueExportRange,
  normalizeRevenueRange,
  previousRevenueRange,
  toVietnamIsoRange,
} from "./revenueDateRange.js";

test("normalizes month and leap-year ranges inclusively", () => {
  assert.deepEqual(normalizeRevenueRange({ mode: "month", month: "2024-02" }), {
    startDate: "2024-02-01",
    endDate: "2024-02-29",
    label: "2024-02",
    highlightedDates: [],
  });
});

test("normalizes reversed custom range and derives equal previous period", () => {
  const current = normalizeRevenueRange({
    mode: "custom",
    startDate: "2026-08-10",
    endDate: "2026-08-01",
  });
  assert.equal(current.startDate, "2026-08-01");
  assert.equal(current.endDate, "2026-08-10");
  assert.deepEqual(previousRevenueRange({ mode: "custom" }, current), {
    startDate: "2026-07-22",
    endDate: "2026-07-31",
    label: "2026-07-22 - 2026-07-31",
    highlightedDates: [],
  });
});

test("allows 366 export days and rejects a larger range", () => {
  assert.doesNotThrow(() =>
    assertRevenueExportRange({ startDate: "2024-01-01", endDate: "2024-12-31" }),
  );
  assert.throws(
    () => assertRevenueExportRange({ startDate: "2024-01-01", endDate: "2025-01-01" }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 400,
  );
});

test("converts Vietnam business dates to UTC inclusive/exclusive bounds", () => {
  assert.deepEqual(
    toVietnamIsoRange({ startDate: "2026-08-27", endDate: "2026-08-27" }),
    {
      startIso: "2026-08-26T17:00:00.000Z",
      endExclusiveIso: "2026-08-27T17:00:00.000Z",
    },
  );
});
