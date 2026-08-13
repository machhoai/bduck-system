import assert from "node:assert/strict";
import test from "node:test";

import {
  addCalendarDays,
  resolvePartnerSyncStartDate,
} from "./partnerPosOrderSyncPolicy.js";

test("incremental partner sync overlaps three days to catch late orders", () => {
  assert.equal(resolvePartnerSyncStartDate("2026-08-13"), "2026-08-10");
});

test("first partner sync starts at the historical migration boundary", () => {
  assert.equal(resolvePartnerSyncStartDate(null), "2025-12-10");
});

test("calendar date arithmetic crosses month and year boundaries", () => {
  assert.equal(addCalendarDays("2026-01-01", -3), "2025-12-29");
});
