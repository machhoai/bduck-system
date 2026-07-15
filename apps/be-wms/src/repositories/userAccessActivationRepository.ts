import type {
  UserAccessMetadata,
  UserAccessVersion,
} from "@bduck/shared-types";
import {
  getUserAccessVersionRef,
  getUserAccessVersionsCollectionRef,
  getUserFacilityAccessCollectionRef,
} from "./userAccessReadRepository.js";
import type {
  ActivationTimestamps,
  UserAccessSnapshotWritePlan,
} from "./userAccessRepository.js";
import {
  assertActiveMetadataMatchesVersion,
  assertCompleteGrantManifest,
  assertSnapshotWritePlanReferences,
  assertStoredVersionMatchesPlan,
  assertUserAccessSnapshotPlan,
  mapUserAccessMetadata,
  mapUserAccessVersion,
  mapUserFacilityAccessGrant,
} from "./userAccessSnapshotRepositoryUtils.js";
import {
  assertUniqueUserAccessVersionNumber,
  assertUserAccessVersionActivationSequence,
  type UserAccessActivationMetadataState,
  type UserAccessActivationVersionState,
} from "./userAccessVersionInvariant.js";

const toMetadataState = (
  metadata: UserAccessMetadata | null,
): UserAccessActivationMetadataState | null =>
  metadata
    ? {
        accessVersion: metadata.access_version,
        activeVersionId: metadata.active_version_id,
        sourceFingerprint: metadata.source_fingerprint,
      }
    : null;

const toVersionState = (
  version: UserAccessVersion | null,
): UserAccessActivationVersionState | null =>
  version
    ? {
        id: version.id,
        sourceFingerprint: version.source_fingerprint,
        status: version.status,
        versionNumber: version.version_number,
      }
    : null;

export const activateUserAccessSnapshotInTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  plan: UserAccessSnapshotWritePlan,
  timestamps: ActivationTimestamps,
): Promise<void> => {
  const expectedGrants = plan.grants.map(({ data }) => data);
  assertSnapshotWritePlanReferences(plan);
  assertUserAccessSnapshotPlan(plan.metadata, plan.version, expectedGrants);
  const sameNumberQuery = getUserAccessVersionsCollectionRef(
    plan.metadata.user_id,
  ).where("version_number", "==", plan.version.version_number);
  const [
    metadataSnapshot,
    versionSnapshot,
    grantsSnapshot,
    sameNumberSnapshot,
  ] = await Promise.all([
    transaction.get(plan.metadataRef),
    transaction.get(plan.versionRef),
    transaction.get(
      getUserFacilityAccessCollectionRef(
        plan.metadata.user_id,
        plan.version.id,
      ),
    ),
    transaction.get(sameNumberQuery),
  ]);
  if (!versionSnapshot.exists)
    throw new Error("USER_ACCESS_VERSION_NOT_STAGED");

  const stagedVersion = mapUserAccessVersion(versionSnapshot);
  assertStoredVersionMatchesPlan(
    stagedVersion,
    plan.version,
    expectedGrants.length,
  );
  assertCompleteGrantManifest(
    grantsSnapshot.docs.map(mapUserFacilityAccessGrant),
    expectedGrants,
  );
  assertUniqueUserAccessVersionNumber(
    stagedVersion.id,
    stagedVersion.version_number,
    sameNumberSnapshot.docs.map((snapshot) => {
      const version = mapUserAccessVersion(snapshot);
      return { id: version.id, status: version.status };
    }),
  );

  const existingMetadata = metadataSnapshot.exists
    ? mapUserAccessMetadata(metadataSnapshot)
    : null;
  if (stagedVersion.status === "ACTIVE") {
    assertActiveMetadataMatchesVersion(existingMetadata, stagedVersion);
    return;
  }
  if (stagedVersion.status !== "BUILDING") {
    throw new Error("USER_ACCESS_VERSION_NOT_ACTIVATABLE");
  }
  if (
    existingMetadata?.is_deleted ||
    (existingMetadata && existingMetadata.user_id !== plan.metadata.user_id)
  ) {
    throw new Error("USER_ACCESS_METADATA_SNAPSHOT_MISMATCH");
  }

  const previousVersionId = existingMetadata?.active_version_id ?? null;
  if (previousVersionId === plan.version.id) {
    throw new Error("USER_ACCESS_ACTIVE_VERSION_POINTER_MISMATCH");
  }
  const previousVersionRef = previousVersionId
    ? getUserAccessVersionRef(plan.metadata.user_id, previousVersionId)
    : null;
  const previousVersionSnapshot = previousVersionRef
    ? await transaction.get(previousVersionRef)
    : null;
  if (previousVersionRef && !previousVersionSnapshot?.exists) {
    throw new Error("USER_ACCESS_PREVIOUS_VERSION_NOT_FOUND");
  }
  const previousVersion = previousVersionSnapshot?.exists
    ? mapUserAccessVersion(previousVersionSnapshot)
    : null;
  if (previousVersion) {
    assertActiveMetadataMatchesVersion(existingMetadata, previousVersion);
  }
  assertUserAccessVersionActivationSequence(
    toMetadataState(existingMetadata),
    toVersionState(stagedVersion)!,
    toVersionState(previousVersion),
  );

  transaction.update(plan.versionRef, {
    status: "ACTIVE",
    activated_at: timestamps.syncTime,
    updated_at: timestamps.syncTime,
    action_time: timestamps.actionTime,
    sync_time: timestamps.syncTime,
  });
  transaction.set(
    plan.metadataRef,
    {
      ...plan.metadata,
      updated_at: timestamps.syncTime,
      action_time: timestamps.actionTime,
      sync_time: timestamps.syncTime,
    },
    { merge: true },
  );

  if (previousVersionRef) {
    transaction.update(previousVersionRef, {
      status: "RETIRED",
      retired_at: timestamps.syncTime,
      updated_at: timestamps.syncTime,
      action_time: timestamps.actionTime,
      sync_time: timestamps.syncTime,
    });
  }
};
