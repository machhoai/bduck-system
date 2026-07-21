import assert from "node:assert/strict";
import test from "node:test";
import {
  isMissingApiRoute,
  shouldBootstrapSessionWithFirebase,
} from "./apiRolloutCompatibility.js";

test("rolling frontend deployment falls back when session route is unavailable", () => {
  assert.equal(shouldBootstrapSessionWithFirebase(401), true);
  assert.equal(shouldBootstrapSessionWithFirebase(404), true);
  assert.equal(shouldBootstrapSessionWithFirebase(405), true);
  assert.equal(shouldBootstrapSessionWithFirebase(403), false);
  assert.equal(shouldBootstrapSessionWithFirebase(500), false);
});

test("dashboard detects only missing-route responses as a legacy backend", () => {
  assert.equal(isMissingApiRoute(404), true);
  assert.equal(isMissingApiRoute(405), true);
  assert.equal(isMissingApiRoute(401), false);
  assert.equal(isMissingApiRoute(500), false);
});
