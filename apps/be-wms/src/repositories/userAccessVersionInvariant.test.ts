import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueUserAccessVersionNumber,
  assertUserAccessVersionActivationSequence,
  type UserAccessActivationMetadataState,
  type UserAccessActivationVersionState,
} from "./userAccessVersionInvariant.js";

const activeVersion = (
  id: string,
  versionNumber: number,
  sourceFingerprint = `fingerprint-${versionNumber}`,
): UserAccessActivationVersionState => ({
  id,
  sourceFingerprint,
  status: "ACTIVE",
  versionNumber,
});

const buildingVersion = (
  id: string,
  versionNumber: number,
): UserAccessActivationVersionState => ({
  id,
  sourceFingerprint: `fingerprint-${versionNumber}`,
  status: "BUILDING",
  versionNumber,
});

const metadataFor = (
  version: UserAccessActivationVersionState,
): UserAccessActivationMetadataState => ({
  accessVersion: version.versionNumber,
  activeVersionId: version.id,
  sourceFingerprint: version.sourceFingerprint,
});

test("accepts version 1 as the only valid initial activation", () => {
  assert.doesNotThrow(() =>
    assertUserAccessVersionActivationSequence(
      null,
      buildingVersion("version-1", 1),
      null,
    ),
  );
  assert.throws(
    () =>
      assertUserAccessVersionActivationSequence(
        null,
        buildingVersion("version-2", 2),
        null,
      ),
    /USER_ACCESS_INITIAL_VERSION_MISMATCH/,
  );
});

test("accepts only the immediate successor of the active version", () => {
  const previous = activeVersion("version-2", 2);
  assert.doesNotThrow(() =>
    assertUserAccessVersionActivationSequence(
      metadataFor(previous),
      buildingVersion("version-3", 3),
      previous,
    ),
  );

  for (const invalidVersionNumber of [1, 2, 4]) {
    assert.throws(
      () =>
        assertUserAccessVersionActivationSequence(
          metadataFor(previous),
          buildingVersion(
            `version-${invalidVersionNumber}`,
            invalidVersionNumber,
          ),
          previous,
        ),
      /USER_ACCESS_VERSION_SEQUENCE_MISMATCH/,
    );
  }
});

test("rejects stale snapshots after a newer version is active", () => {
  const active = activeVersion("version-3", 3);
  assert.throws(
    () =>
      assertUserAccessVersionActivationSequence(
        metadataFor(active),
        buildingVersion("stale-version-2", 2),
        active,
      ),
    /USER_ACCESS_VERSION_SEQUENCE_MISMATCH/,
  );
});

test("rejects metadata version or fingerprint drift", () => {
  const previous = activeVersion("version-2", 2);
  assert.throws(
    () =>
      assertUserAccessVersionActivationSequence(
        { ...metadataFor(previous), accessVersion: 1 },
        buildingVersion("version-3", 3),
        previous,
      ),
    /USER_ACCESS_PREVIOUS_VERSION_MISMATCH/,
  );
  assert.throws(
    () =>
      assertUserAccessVersionActivationSequence(
        { ...metadataFor(previous), sourceFingerprint: "different" },
        buildingVersion("version-3", 3),
        previous,
      ),
    /USER_ACCESS_PREVIOUS_VERSION_MISMATCH/,
  );
});

test("rejects a second version id with the same version number", () => {
  assert.doesNotThrow(() =>
    assertUniqueUserAccessVersionNumber("version-2", 2, [
      { id: "version-2", status: "BUILDING" },
    ]),
  );

  for (const status of ["BUILDING", "ACTIVE", "RETIRED"] as const) {
    assert.throws(
      () =>
        assertUniqueUserAccessVersionNumber("version-2-a", 2, [
          { id: "version-2-a", status: "BUILDING" },
          { id: "version-2-b", status },
        ]),
      /USER_ACCESS_VERSION_NUMBER_CONFLICT/,
    );
  }
});

test("allows recovery when only a failed snapshot shares the number", () => {
  assert.doesNotThrow(() =>
    assertUniqueUserAccessVersionNumber("version-4-recovery", 4, [
      { id: "version-4-failed", status: "FAILED" },
      { id: "version-4-recovery", status: "BUILDING" },
    ]),
  );
});
