import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficeScopeDraftSummary } from "./officeScopeDraft.js";

test("detects added and removed facilities in a selected draft", () => {
  const summary = buildOfficeScopeDraftSummary({
    baselineMode: "SELECTED",
    baselineSelectedIds: ["warehouse-c", "store-d"],
    baselineEffectiveIds: ["warehouse-c", "store-d"],
    mode: "SELECTED",
    selectedIds: ["store-d", "store-e"],
    manageableIds: ["warehouse-c", "store-d", "store-e"],
  });

  assert.equal(summary.isDirty, true);
  assert.deepEqual(summary.addedIds, ["store-e"]);
  assert.deepEqual(summary.removedIds, ["warehouse-c"]);
});

test("treats ALL as a dynamic set of every manageable facility", () => {
  const summary = buildOfficeScopeDraftSummary({
    baselineMode: "SELECTED",
    baselineSelectedIds: ["warehouse-c"],
    baselineEffectiveIds: ["warehouse-c"],
    mode: "ALL",
    selectedIds: ["warehouse-c"],
    manageableIds: ["warehouse-c", "store-d"],
  });

  assert.equal(summary.isDirty, true);
  assert.deepEqual(summary.afterIds, ["store-d", "warehouse-c"]);
  assert.deepEqual(summary.addedIds, ["store-d"]);
  assert.deepEqual(summary.removedIds, []);
});

test("ignores selection order and duplicate IDs", () => {
  const summary = buildOfficeScopeDraftSummary({
    baselineMode: "SELECTED",
    baselineSelectedIds: ["store-d", "warehouse-c"],
    baselineEffectiveIds: ["warehouse-c", "store-d"],
    mode: "SELECTED",
    selectedIds: ["warehouse-c", "store-d", "store-d"],
    manageableIds: ["warehouse-c", "store-d"],
  });

  assert.equal(summary.isDirty, false);
  assert.deepEqual(summary.addedIds, []);
  assert.deepEqual(summary.removedIds, []);
});
