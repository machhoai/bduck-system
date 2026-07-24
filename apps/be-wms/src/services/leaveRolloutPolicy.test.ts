import { resolveLeaveFeatureEnabled } from "@bduck/shared-types";
import assert from "node:assert/strict";
import test from "node:test";

test("leave feature defaults off in production and on outside production", () => {
  assert.equal(resolveLeaveFeatureEnabled(undefined, "production"), false);
  assert.equal(resolveLeaveFeatureEnabled(undefined, "development"), true);
});

test("leave feature accepts explicit rollout values", () => {
  assert.equal(resolveLeaveFeatureEnabled("enabled", "production"), true);
  assert.equal(resolveLeaveFeatureEnabled("false", "development"), false);
  assert.throws(
    () => resolveLeaveFeatureEnabled("sometimes", "production"),
    /LEAVE_FEATURE_ENABLED_INVALID/,
  );
});
