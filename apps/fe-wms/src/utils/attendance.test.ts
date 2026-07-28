import assert from "node:assert/strict";
import test from "node:test";
import type { AttendanceLateReport } from "@bduck/shared-types";
import { getLateReportArrivalTime } from "./attendance";

test("uses the estimated arrival time for new late reports", () => {
  assert.equal(
    getLateReportArrivalTime({
      estimated_arrival_time: "09:15",
      expected_arrival_time: null,
    }),
    "09:15",
  );
});

test("falls back to the legacy expected arrival time", () => {
  assert.equal(
    getLateReportArrivalTime({
      estimated_arrival_time: null,
      expected_arrival_time: "09:30",
    }),
    "09:30",
  );
});

test("prefers estimated arrival time when both legacy fields exist", () => {
  const report = {
    estimated_arrival_time: "09:45",
    expected_arrival_time: "09:30",
  } satisfies Pick<
    AttendanceLateReport,
    "estimated_arrival_time" | "expected_arrival_time"
  >;

  assert.equal(getLateReportArrivalTime(report), "09:45");
});
