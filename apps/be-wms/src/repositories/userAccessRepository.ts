import type {
  UserAccessMetadata,
  UserAccessVersion,
  UserFacilityAccessGrant,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  getUserAccessMetadataRef,
  getUserAccessVersionRef,
  getUserFacilityAccessCollectionRef,
  getUserFacilityAccessGrantRef,
} from "./userAccessReadRepository.js";
import {
  assertCompleteGrantManifest,
  assertGrantMatchesPlan,
  assertPartialGrantManifest,
  assertSnapshotWritePlanReferences,
  assertStoredVersionMatchesPlan,
  assertUserAccessSnapshotPlan,
  mapUserAccessVersion,
  mapUserFacilityAccessGrant,
} from "./userAccessSnapshotRepositoryUtils.js";

export interface UserAccessSnapshotWritePlan {
  metadataRef: FirebaseFirestore.DocumentReference;
  metadata: UserAccessMetadata;
  versionRef: FirebaseFirestore.DocumentReference;
  version: UserAccessVersion;
  grants: Array<{
    ref: FirebaseFirestore.DocumentReference;
    data: UserFacilityAccessGrant;
  }>;
}

export interface CreateUserAccessSnapshotWritePlanInput {
  metadata: UserAccessMetadata;
  version: UserAccessVersion;
  grants: UserFacilityAccessGrant[];
}

export interface ActivationTimestamps {
  actionTime: Date;
  syncTime: Date;
}

const GRANTS_PER_BATCH = 400;

export {
  findUserFacilityAccessGrants,
  findUserAccessVersionsByNumber,
  getActiveUserAccessVersion,
  getUserAccessMetadata,
  getUserAccessMetadataRef,
  getUserAccessVersion,
  getUserAccessVersionRef,
  getUserAccessVersionsCollectionRef,
  getUserFacilityAccessCollectionRef,
  getUserFacilityAccessGrant,
  getUserFacilityAccessGrantRef,
} from "./userAccessReadRepository.js";
export { activateUserAccessSnapshotInTransaction } from "./userAccessActivationRepository.js";

export const createUserAccessSnapshotWritePlan = ({
  metadata,
  version,
  grants,
}: CreateUserAccessSnapshotWritePlanInput): UserAccessSnapshotWritePlan => {
  const grantCount = grants.length;
  const plan: UserAccessSnapshotWritePlan = {
    metadataRef: getUserAccessMetadataRef(metadata.user_id),
    metadata: {
      ...metadata,
      active_version_id: version.id,
      access_version: version.version_number,
      facility_grant_count: grantCount,
    },
    versionRef: getUserAccessVersionRef(metadata.user_id, version.id),
    version: {
      ...version,
      status: "BUILDING",
      facility_grant_count: grantCount,
      activated_at: null,
      retired_at: null,
    },
    grants: grants.map((grant) => ({
      ref: getUserFacilityAccessGrantRef(
        metadata.user_id,
        version.id,
        grant.facility_id,
      ),
      data: grant,
    })),
  };
  assertUserAccessSnapshotPlan(plan.metadata, plan.version, grants);
  return plan;
};

// Partial failures stay in BUILDING and never move the active version pointer.
export const stageUserAccessSnapshot = async (
  plan: UserAccessSnapshotWritePlan,
): Promise<void> => {
  const expectedGrants = plan.grants.map(({ data }) => data);
  assertSnapshotWritePlanReferences(plan);
  assertUserAccessSnapshotPlan(plan.metadata, plan.version, expectedGrants);

  await db.runTransaction(async (transaction) => {
    const [versionSnapshot, grantsSnapshot] = await Promise.all([
      transaction.get(plan.versionRef),
      transaction.get(
        getUserFacilityAccessCollectionRef(
          plan.metadata.user_id,
          plan.version.id,
        ),
      ),
    ]);
    assertPartialGrantManifest(
      grantsSnapshot.docs.map(mapUserFacilityAccessGrant),
      expectedGrants,
    );
    if (!versionSnapshot.exists) {
      transaction.create(plan.versionRef, plan.version);
      return;
    }

    const storedVersion = mapUserAccessVersion(versionSnapshot);
    if (
      storedVersion.status === "ACTIVE" ||
      storedVersion.status === "RETIRED"
    ) {
      throw new Error("USER_ACCESS_VERSION_IMMUTABLE");
    }
    if (storedVersion.status !== "BUILDING") {
      throw new Error("USER_ACCESS_VERSION_NOT_STAGEABLE");
    }
    assertStoredVersionMatchesPlan(
      storedVersion,
      plan.version,
      expectedGrants.length,
    );
  });

  for (
    let offset = 0;
    offset < plan.grants.length;
    offset += GRANTS_PER_BATCH
  ) {
    const chunk = plan.grants.slice(offset, offset + GRANTS_PER_BATCH);
    await db.runTransaction(async (transaction) => {
      const [versionSnapshot, ...snapshots] = await Promise.all([
        transaction.get(plan.versionRef),
        ...chunk.map(({ ref }) => transaction.get(ref)),
      ]);
      if (!versionSnapshot?.exists) {
        throw new Error("USER_ACCESS_VERSION_NOT_STAGED");
      }
      const storedVersion = mapUserAccessVersion(versionSnapshot);
      if (storedVersion.status !== "BUILDING") {
        throw new Error("USER_ACCESS_VERSION_IMMUTABLE");
      }
      assertStoredVersionMatchesPlan(
        storedVersion,
        plan.version,
        expectedGrants.length,
      );
      snapshots.forEach((snapshot, index) => {
        const grant = chunk[index];
        if (!grant) throw new Error("USER_ACCESS_GRANT_CHUNK_MISMATCH");
        if (snapshot.exists) {
          assertGrantMatchesPlan(
            mapUserFacilityAccessGrant(snapshot),
            grant.data,
          );
        } else {
          transaction.create(grant.ref, grant.data);
        }
      });
    });
  }

  const stagedSnapshot = await getUserFacilityAccessCollectionRef(
    plan.metadata.user_id,
    plan.version.id,
  ).get();
  assertCompleteGrantManifest(
    stagedSnapshot.docs.map(mapUserFacilityAccessGrant),
    expectedGrants,
  );
};

export const markUserAccessSnapshotFailed = async (
  plan: UserAccessSnapshotWritePlan,
  failedAt = new Date(),
): Promise<void> => {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(plan.versionRef);
    if (!snapshot.exists) return;
    const version = mapUserAccessVersion(snapshot);
    if (version.status === "FAILED") return;
    if (version.status !== "BUILDING") {
      throw new Error("USER_ACCESS_VERSION_IMMUTABLE");
    }
    transaction.update(plan.versionRef, {
      status: "FAILED",
      updated_at: failedAt,
      sync_time: failedAt,
    });
  });
};

export const markBuildingUserAccessVersionsFailed = async (
  userId: string,
  versionIds: readonly string[],
  failedAt = new Date(),
): Promise<void> => {
  const refs = Array.from(new Set(versionIds)).map((versionId) =>
    getUserAccessVersionRef(userId, versionId),
  );
  if (refs.length === 0) return;
  await db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...refs);
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const version = mapUserAccessVersion(snapshot);
      if (version.status === "BUILDING") {
        transaction.update(refs[index], {
          status: "FAILED",
          updated_at: failedAt,
          sync_time: failedAt,
        });
      }
    });
  });
};
