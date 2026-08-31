import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPosProductGroupKey,
  isPosProductUpstreamVisible,
} from "./posProductVisibilityPolicy.js";
import { posProductVisibilitySettingsSchema } from "./posProductVisibilitySchemas.js";

test("group key prefers stable type id and includes the top category", () => {
  assert.equal(
    buildPosProductGroupKey({ category: 4, typeId: " Ticket-A ", typeName: "Vé" }),
    "category:4:id:ticket-a",
  );
});

test("group key falls back to normalized subgroup name for souvenirs", () => {
  assert.equal(
    buildPosProductGroupKey({ category: 10, typeName: "  Gấu  Bông " }),
    "category:10:name:gấu bông",
  );
});

test("upstream flags always take precedence over local visibility", () => {
  assert.equal(isPosProductUpstreamVisible({}), true);
  assert.equal(isPosProductUpstreamVisible({ isOpenSales: false }), false);
  assert.equal(isPosProductUpstreamVisible({ syncStatus: "disabled" }), false);
});

test("settings input deduplicates and sorts keys", () => {
  const value = posProductVisibilitySettingsSchema.parse({
    expected_version: 3,
    disabled_group_keys: ["b", "a", "a"],
    disabled_product_ids: ["p2", "p1", "p2"],
    action_time: "2026-08-31T10:00:00+07:00",
  });
  assert.deepEqual(value.disabled_group_keys, ["a", "b"]);
  assert.deepEqual(value.disabled_product_ids, ["p1", "p2"]);
});
