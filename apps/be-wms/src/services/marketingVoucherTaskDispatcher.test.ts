import assert from "node:assert/strict";
import test from "node:test";

import { marketingVoucherLocalWorkerEnabled } from "./marketingVoucherTaskDispatcher.js";

test("local voucher worker is enabled only outside production", () => {
  assert.equal(marketingVoucherLocalWorkerEnabled("development", "true"), true);
  assert.equal(marketingVoucherLocalWorkerEnabled("test", "enabled"), true);
  assert.equal(marketingVoucherLocalWorkerEnabled("production", "true"), false);
});

test("local voucher worker defaults to disabled", () => {
  assert.equal(marketingVoucherLocalWorkerEnabled("development", ""), false);
  assert.equal(marketingVoucherLocalWorkerEnabled("development", "false"), false);
});
