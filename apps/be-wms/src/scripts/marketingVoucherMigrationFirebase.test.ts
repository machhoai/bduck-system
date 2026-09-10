import assert from "node:assert/strict";
import test from "node:test";

import { resolveMarketingVoucherTargetBucket } from "./marketingVoucherMigrationFirebase.js";

test("production migration resolves the production Storage bucket", () => {
  assert.equal(
    resolveMarketingVoucherTargetBucket({
      expectedProjectId: "jw-system-f2104",
      productionBucket: "jw-system-f2104.firebasestorage.app",
      testBucket: "test-jw-system.firebasestorage.app",
    }),
    "jw-system-f2104.firebasestorage.app",
  );
});

test("explicit migration bucket overrides environment-specific buckets", () => {
  assert.equal(
    resolveMarketingVoucherTargetBucket({
      expectedProjectId: "jw-system-f2104",
      explicitBucket: "explicit-production-bucket",
      productionBucket: "jw-system-f2104.firebasestorage.app",
      testBucket: "test-jw-system.firebasestorage.app",
    }),
    "explicit-production-bucket",
  );
});

test("non-production migration resolves the test Storage bucket", () => {
  assert.equal(
    resolveMarketingVoucherTargetBucket({
      expectedProjectId: "test-jw-system",
      productionBucket: "jw-system-f2104.firebasestorage.app",
      testBucket: "test-jw-system.firebasestorage.app",
    }),
    "test-jw-system.firebasestorage.app",
  );
});
