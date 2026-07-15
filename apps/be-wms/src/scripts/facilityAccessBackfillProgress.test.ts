import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMigrationItemProgressDelta,
  type MigrationItemProgressDelta,
  validateMigrationLease,
} from "./facilityAccessBackfillProgress.js";
import {
  BackfillPreconditionConflictError,
  isBackfillPreconditionConflict,
} from "./facilityAccessBackfillErrors.js";

const now = new Date("2026-07-15T00:00:00.000Z");
const validLeaseExpiry = new Date("2026-07-15T00:05:00.000Z");
const validState = {
  exists: true,
  leaseOwner: "runner-a",
  stage: "USERS",
  leaseExpiresAt: { toDate: () => validLeaseExpiry },
};

test("rejects a lease owned by another migration runner", () => {
  const result = validateMigrationLease(validState, "runner-b", "USERS", now);

  assert.deepEqual(result, { valid: false, reason: "WRONG_OWNER" });
});

test("rejects a missing migration state", () => {
  const result = validateMigrationLease(
    { ...validState, exists: false },
    "runner-a",
    "USERS",
    now,
  );

  assert.deepEqual(result, { valid: false, reason: "STATE_MISSING" });
});

test("rejects a lease that expires at or before the transaction time", () => {
  const result = validateMigrationLease(
    { ...validState, leaseExpiresAt: now },
    "runner-a",
    "USERS",
    now,
  );

  assert.deepEqual(result, { valid: false, reason: "LEASE_EXPIRED" });
});

test("rejects item progress for a different migration stage", () => {
  const result = validateMigrationLease(
    validState,
    "runner-a",
    "ASSIGNMENTS",
    now,
  );

  assert.deepEqual(result, { valid: false, reason: "WRONG_STAGE" });
});

test("accepts an active lease for the expected owner and stage", () => {
  const result = validateMigrationLease(validState, "runner-a", "USERS", now);

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.expiresAt.getTime(), validLeaseExpiry.getTime());
  }
});

interface ProjectedState {
  cursor: string | null;
  processedCount: number;
  plannedWriteCount: number;
  writtenCount: number;
}

const applyCommittedDelta = (
  state: ProjectedState,
  delta: MigrationItemProgressDelta,
): ProjectedState => ({
  cursor: delta.cursorValue,
  processedCount: state.processedCount + delta.counterIncrement,
  plannedWriteCount: state.plannedWriteCount + delta.plannedWriteIncrement,
  writtenCount: state.writtenCount + delta.writtenWriteIncrement,
});

test("commits cursor and counters as one item delta before crash-resume", () => {
  const itemIds = ["user-a", "user-b", "user-c"];
  const firstDelta = buildMigrationItemProgressDelta(
    {
      stage: "USERS",
      cursorField: "last_processed_user_id",
      cursorValue: itemIds[0],
      counterField: "processed_user_count",
      issues: [],
    },
    2,
    2,
  );

  const persistedBeforeCrash = applyCommittedDelta(
    {
      cursor: null,
      processedCount: 0,
      plannedWriteCount: 0,
      writtenCount: 0,
    },
    firstDelta,
  );

  assert.equal(firstDelta.cursorField, "last_processed_user_id");
  assert.equal(firstDelta.counterField, "processed_user_count");
  assert.equal(persistedBeforeCrash.cursor, "user-a");
  assert.equal(persistedBeforeCrash.processedCount, 1);
  assert.equal(persistedBeforeCrash.plannedWriteCount, 2);
  assert.equal(persistedBeforeCrash.writtenCount, 2);

  const resumeIndex = itemIds.indexOf(persistedBeforeCrash.cursor ?? "") + 1;
  assert.deepEqual(itemIds.slice(resumeIndex), ["user-b", "user-c"]);
});

test("counts duplicate issue codes in the same committed item", () => {
  const delta = buildMigrationItemProgressDelta(
    {
      stage: "PROFILE_DIAGNOSTICS",
      cursorField: "last_scanned_profile_id",
      cursorValue: "profile-a",
      counterField: "scanned_profile_count",
      issues: [
        {
          code: "ORPHAN_PROFILE_USER_NOT_FOUND",
          entity_type: "employee_profiles",
          entity_id: "profile-a",
          detail: "First reference",
        },
        {
          code: "ORPHAN_PROFILE_USER_NOT_FOUND",
          entity_type: "employee_profiles",
          entity_id: "profile-a",
          detail: "Second reference",
        },
      ],
    },
    0,
    0,
  );

  assert.equal(delta.issueCountIncrements.ORPHAN_PROFILE_USER_NOT_FOUND, 2);
});

test("only typed precondition conflicts may advance a skipped item cursor", () => {
  assert.equal(
    isBackfillPreconditionConflict(
      new BackfillPreconditionConflictError("SOURCE_CHANGED"),
    ),
    true,
  );
  assert.equal(isBackfillPreconditionConflict(new Error("UNAVAILABLE")), false);
});
