import assert from "node:assert/strict";
import test from "node:test";
import { classifyRemoteFailure } from "./connectivityPolicy.js";

test("remote service errors are not mislabeled as an offline browser", () => {
  assert.equal(classifyRemoteFailure(true), "error");
  assert.equal(classifyRemoteFailure(false), "offline");
});
