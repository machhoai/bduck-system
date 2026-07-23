import assert from "node:assert/strict";
import test from "node:test";
import {
  getRequestLocalFirebaseTarget,
  isLocalFirebaseTarget,
  isLocalFirebaseTargetSelectionEnabled,
  runWithLocalFirebaseTarget,
} from "./firebaseTargetContext.js";

test("accepts only the two supported local Firebase targets", () => {
  assert.equal(isLocalFirebaseTarget("test-jw-system"), true);
  assert.equal(isLocalFirebaseTarget("jw-system-f2104"), true);
  assert.equal(isLocalFirebaseTarget("another-project"), false);
});

test("enables project selection only in development", () => {
  assert.equal(isLocalFirebaseTargetSelectionEnabled("development"), true);
  assert.equal(isLocalFirebaseTargetSelectionEnabled("production"), false);
  assert.equal(isLocalFirebaseTargetSelectionEnabled("test"), false);
});

test("keeps concurrent request targets isolated", async () => {
  const fallback = "test-jw-system" as const;
  const readTargetAfterYield = async () => {
    await Promise.resolve();
    return getRequestLocalFirebaseTarget(fallback);
  };

  const [testTarget, productionTarget] = await Promise.all([
    runWithLocalFirebaseTarget("test-jw-system", readTargetAfterYield),
    runWithLocalFirebaseTarget("jw-system-f2104", readTargetAfterYield),
  ]);

  assert.equal(testTarget, "test-jw-system");
  assert.equal(productionTarget, "jw-system-f2104");
  assert.equal(getRequestLocalFirebaseTarget(fallback), fallback);
});
