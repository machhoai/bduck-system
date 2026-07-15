import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustProxySetting } from "./rateLimitMiddleware.js";

test("uses one trusted proxy hop only in production by default", () => {
  assert.equal(resolveTrustProxySetting(undefined, "production"), 1);
  assert.equal(resolveTrustProxySetting(undefined, "development"), false);
});

test("accepts a bounded explicit proxy hop count", () => {
  assert.equal(resolveTrustProxySetting("2", "production"), 2);
  assert.equal(resolveTrustProxySetting("10", "production"), 10);
});

test("fails closed for unsafe or malformed proxy settings", () => {
  assert.equal(resolveTrustProxySetting("true", "production"), false);
  assert.equal(resolveTrustProxySetting("11", "production"), false);
  assert.equal(resolveTrustProxySetting("-1", "production"), false);
  assert.equal(resolveTrustProxySetting("0", "production"), false);
});
