import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialOfficeScopeMaterializationState,
  resolveOfficeScopeMaterializationProgress,
} from "./officeScopeMaterializationPolicy.js";

test("an Office without employees completes materialization immediately", () => {
  assert.deepEqual(createInitialOfficeScopeMaterializationState(0), {
    status: "COMPLETED",
    requestedCount: 0,
    completedCount: 0,
    failedCount: 0,
    attempts: 0,
  });
});

test("records a partial materialization failure without losing completed users", () => {
  const result = resolveOfficeScopeMaterializationProgress(
    {
      requestedUserIds: ["user-a", "user-b", "user-c"],
      completedUserIds: [],
      failedUserIds: [],
      errors: {},
    },
    ["user-a", "user-b", "user-c"],
    [{ userId: "user-b", error: "TRANSIENT_FAILURE" }],
  );
  assert.equal(result.status, "FAILED");
  assert.deepEqual(result.completedUserIds, ["user-a", "user-c"]);
  assert.deepEqual(result.failedUserIds, ["user-b"]);
});

test("retry is idempotent and only advances previously failed users", () => {
  const state = {
    requestedUserIds: ["user-a", "user-b", "user-c"],
    completedUserIds: ["user-a", "user-c"],
    failedUserIds: ["user-b"],
    errors: { "user-b": "TRANSIENT_FAILURE" },
  };
  const completed = resolveOfficeScopeMaterializationProgress(
    state,
    ["user-b"],
    [],
  );
  assert.equal(completed.status, "COMPLETED");
  assert.deepEqual(completed.completedUserIds, ["user-a", "user-b", "user-c"]);
  assert.deepEqual(completed.failedUserIds, []);
  const repeated = resolveOfficeScopeMaterializationProgress(
    {
      ...state,
      completedUserIds: completed.completedUserIds,
      failedUserIds: completed.failedUserIds,
      errors: completed.errors,
    },
    ["user-b"],
    [],
  );
  assert.deepEqual(repeated.completedUserIds, completed.completedUserIds);
  assert.equal(repeated.status, "COMPLETED");
});

test("keeps the operation pending while some requested users are unprocessed", () => {
  const result = resolveOfficeScopeMaterializationProgress(
    {
      requestedUserIds: ["user-a", "user-b"],
      completedUserIds: [],
      failedUserIds: [],
      errors: {},
    },
    ["user-a"],
    [],
  );
  assert.equal(result.status, "PENDING");
  assert.deepEqual(result.unprocessedUserIds, ["user-b"]);
});
