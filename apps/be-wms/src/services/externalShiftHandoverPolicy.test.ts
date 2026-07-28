import assert from "node:assert/strict";
import test from "node:test";
import { ExternalCountCheckpointType } from "@bduck/shared-types";
import {
  calculateExternalCountExpectation,
  isOpeningExternalCheckpoint,
  isSameExternalShift,
  isStaleExternalHandover,
  shouldFinalizeQueuedScan,
} from "./externalShiftHandoverPolicy.js";

test("opening checkpoint includes the new value and its legacy equivalent", () => {
  assert.equal(
    isOpeningExternalCheckpoint(ExternalCountCheckpointType.SHIFT_OPENING),
    true,
  );
  assert.equal(
    isOpeningExternalCheckpoint(ExternalCountCheckpointType.BEFORE_SCAN),
    true,
  );
  assert.equal(
    isOpeningExternalCheckpoint(ExternalCountCheckpointType.OPTIONAL_CLOSING),
    false,
  );
});

test("valid inventory movement during a count adjusts the expectation", () => {
  assert.deepEqual(calculateExternalCountExpectation(10, 8), {
    movementDelta: -2,
    expectedAtCountTime: 8,
  });
  assert.deepEqual(calculateExternalCountExpectation(null, 8), {
    movementDelta: 0,
    expectedAtCountTime: 8,
  });
});

test("an older count cannot reclaim access after a newer count", () => {
  const active = new Date("2026-07-28T05:00:00.000Z");
  assert.equal(
    isStaleExternalHandover(active, new Date("2026-07-28T04:59:59.000Z")),
    true,
  );
  assert.equal(
    isStaleExternalHandover(active, new Date("2026-07-28T05:00:01.000Z")),
    false,
  );
});

test("a second count in the already active shift is not another handover", () => {
  assert.equal(
    isSameExternalShift("Ca 2", "2026-07-28", "Ca 2", "2026-07-28"),
    true,
  );
  assert.equal(
    isSameExternalShift("Ca 1", "2026-07-28", "Ca 2", "2026-07-28"),
    false,
  );
});

test("handover finalizes only legacy and previous-shift scans", () => {
  assert.equal(shouldFinalizeQueuedScan(null, "old", "new"), true);
  assert.equal(shouldFinalizeQueuedScan("old", "old", "new"), true);
  assert.equal(shouldFinalizeQueuedScan("new", "old", "new"), false);
  assert.equal(shouldFinalizeQueuedScan("other", "old", "new"), false);
});
