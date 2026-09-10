import assert from "node:assert/strict";
import test from "node:test";
import {
  readRevenueExportAliases,
  revenueExportPreferenceKey,
  writeRevenueExportAliases,
} from "./revenueExportPreferences.js";

test("export aliases use separate project, account and source keys", () => {
  assert.notEqual(
    revenueExportPreferenceKey("p", "alice", "LOCAL_POS"),
    revenueExportPreferenceKey("p", "bob", "LOCAL_POS"),
  );
  assert.notEqual(
    revenueExportPreferenceKey("p", "alice", "LOCAL_POS"),
    revenueExportPreferenceKey("p", "alice", "OPEN_API"),
  );
  assert.notEqual(
    revenueExportPreferenceKey("p", "alice", "LOCAL_POS"),
    revenueExportPreferenceKey("q", "alice", "LOCAL_POS"),
  );
});

test("stored aliases ignore corrupt and invalid values", () => {
  assert.deepEqual(readRevenueExportAliases({ getItem: () => "{" }, "key"), {});
  const value = readRevenueExportAliases(
    {
      getItem: () =>
        JSON.stringify({ valid: "Tên mới", empty: "", object: { bad: true } }),
    },
    "key",
  );
  assert.deepEqual(value, { valid: "Tên mới" });
});

test("saving aliases removes empty values", () => {
  let saved = "";
  writeRevenueExportAliases(
    {
      setItem: (_key, value) => {
        saved = value;
      },
    },
    "key",
    { valid: "Tên mới", empty: " " },
  );
  assert.deepEqual(JSON.parse(saved), { valid: "Tên mới" });
});
