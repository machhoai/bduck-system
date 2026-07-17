import {
  AuditAction,
  UserStatus,
  type UserAccessMetadata,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  loadAuthorizationRequestSource,
  loadAuthorizationRequestSourceInTransaction,
} from "../repositories/authorizationSourceRepository.js";
import {
  activateUserAccessSnapshotInTransaction,
  createUserAccessSnapshotWritePlan,
  findUserFacilityAccessGrants,
  findUserAccessVersionsByNumber,
  getUserAccessMetadata,
  getUserAccessVersion,
  markUserAccessSnapshotFailed,
  markBuildingUserAccessVersionsFailed,
  stageUserAccessSnapshot,
} from "../repositories/userAccessRepository.js";
import {
  acquireUserAccessRebuildLease,
  releaseUserAccessRebuildLease,
} from "../repositories/userAccessRebuildLockRepository.js";
import { mapUserAccessMetadata } from "../repositories/userAccessSnapshotRepositoryUtils.js";
import {
  AuthorizationError,
  buildAccessContext,
  type AuthorizationSourceSnapshot,
} from "./authorization/index.js";
import {
  createAccessSourceFingerprint,
  createUserAccessMaterializationPlan,
  emptyMaterializedSeed,
  materializedSeedFromContext,
  resolveMaterializedVersion,
  type MaterializedAccessSeed,
} from "./userAccessMaterializationPlan.js";

export interface MaterializationResult {
  userId: string;
  accessVersion: number;
  versionId: string;
  changed: boolean;
  facilityGrantCount: number;
}

const workplaceId = (value: unknown): string | null =>
  typeof value === "string" && value.trim() === value && value.length > 0
    ? value
    : null;

const buildMaterializedSeed = (
  userId: string,
  requestUser: {
    status?: UserStatus;
    is_deleted?: boolean;
    workplace_facility_id?: unknown;
  } | null,
  snapshot: AuthorizationSourceSnapshot,
): MaterializedAccessSeed => {
  if (
    !requestUser ||
    requestUser.status !== UserStatus.ACTIVE ||
    requestUser.is_deleted !== false
  ) {
    return emptyMaterializedSeed(
      userId,
      workplaceId(requestUser?.workplace_facility_id),
    );
  }
  try {
    return materializedSeedFromContext(buildAccessContext(snapshot));
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    return emptyMaterializedSeed(
      userId,
      workplaceId(requestUser.workplace_facility_id),
    );
  }
};

const isCurrentMaterialization = async (
  metadata: UserAccessMetadata | null,
  seed: MaterializedAccessSeed,
): Promise<boolean> => {
  if (
    !metadata ||
    metadata.is_deleted ||
    metadata.source_fingerprint !== createAccessSourceFingerprint(seed) ||
    metadata.workplace_facility_id !== seed.workplaceFacilityId ||
    metadata.is_global_admin !== seed.isSystemAdmin ||
    metadata.facility_grant_count !== seed.grants.length ||
    !metadata.active_version_id
  ) {
    return false;
  }
  const version = await getUserAccessVersion(
    metadata.user_id,
    metadata.active_version_id,
  );
  if (
    !version ||
    version.status !== "ACTIVE" ||
    version.version_number !== metadata.access_version ||
    version.source_fingerprint !== metadata.source_fingerprint
  ) {
    return false;
  }
  const grants = await findUserFacilityAccessGrants(
    metadata.user_id,
    version.id,
  );
  if (
    grants.length !== seed.grants.length ||
    grants.some(
      (grant) =>
        grant.access_version !== version.version_number ||
        grant.access_version_id !== version.id,
    )
  ) {
    return false;
  }
  return (
    createAccessSourceFingerprint({
      ...seed,
      grants: grants.map((grant) => ({
        facilityId: grant.facility_id,
        facilityType: grant.facility_type,
        permissions: grant.permissions,
        sources: grant.sources,
      })),
    }) === metadata.source_fingerprint
  );
};

const auditRef = (userId: string, versionId: string) =>
  db.collection("audit_logs").doc(`${userId}_${versionId}`);

export const materializeUserAccess = async (
  userId: string,
  computedBy: string,
  actionTime = new Date(),
): Promise<MaterializationResult> => {
  const leaseOwner = await acquireUserAccessRebuildLease(userId, computedBy);
  let operationError: unknown = null;
  try {
    const [source, existingMetadata] = await Promise.all([
      loadAuthorizationRequestSource(userId),
      getUserAccessMetadata(userId, true),
    ]);
    const seed = buildMaterializedSeed(
      userId,
      source.requestUser,
      source.snapshot,
    );
    if (await isCurrentMaterialization(existingMetadata, seed)) {
      return {
        userId,
        accessVersion: existingMetadata!.access_version,
        versionId: existingMetadata!.active_version_id!,
        changed: false,
        facilityGrantCount: existingMetadata!.facility_grant_count,
      };
    }

    const syncTime = new Date();
    const versionNumber = (existingMetadata?.access_version ?? 0) + 1;
    const sourceFingerprint = createAccessSourceFingerprint(seed);
    const versionsWithNumber = await findUserAccessVersionsByNumber(
      userId,
      versionNumber,
    );
    const versionResolution = resolveMaterializedVersion(
      versionNumber,
      sourceFingerprint,
      versionsWithNumber,
    );
    await markBuildingUserAccessVersionsFailed(
      userId,
      versionResolution.staleBuildingVersionIds,
    );
    const materialization = createUserAccessMaterializationPlan({
      seed,
      versionNumber,
      versionId: versionResolution.versionId,
      computedBy,
      actionTime,
      syncTime,
      existingMetadata,
    });
    const plan = createUserAccessSnapshotWritePlan(materialization);
    await stageUserAccessSnapshot(plan);

    try {
      await db.runTransaction(async (transaction) => {
        const activationTime = new Date();
        const currentSource = await loadAuthorizationRequestSourceInTransaction(
          transaction,
          userId,
          activationTime,
        );
        const currentSeed = buildMaterializedSeed(
          userId,
          currentSource.requestUser,
          currentSource.snapshot,
        );
        if (
          createAccessSourceFingerprint(currentSeed) !==
          plan.version.source_fingerprint
        ) {
          throw new Error("USER_ACCESS_SOURCE_CHANGED");
        }
        const oldSnapshot = await transaction.get(plan.metadataRef);
        const oldMetadata = oldSnapshot.exists
          ? mapUserAccessMetadata(oldSnapshot)
          : null;
        const activation = await activateUserAccessSnapshotInTransaction(
          transaction,
          plan,
          { actionTime, syncTime: activationTime },
        );
        if (activation === "UNCHANGED") return;
        transaction.create(auditRef(userId, plan.version.id), {
          id: `${userId}_${plan.version.id}`,
          entity_type: "user_access",
          entity_id: userId,
          warehouse_id: plan.metadata.workplace_facility_id,
          action: oldMetadata ? AuditAction.UPDATE : AuditAction.CREATE,
          user_id: computedBy,
          user_name: null,
          entity_name: userId,
          action_time: actionTime,
          sync_time: activationTime,
          old_value: oldMetadata,
          new_value: {
            ...plan.metadata,
            updated_at: activationTime,
            sync_time: activationTime,
          },
          ip_address: null,
          device_id: null,
          session_token: null,
          notes: "Activate materialized effective facility grants",
        });
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "USER_ACCESS_SOURCE_CHANGED"
      ) {
        await markUserAccessSnapshotFailed(plan);
      }
      throw error;
    }

    return {
      userId,
      accessVersion: plan.version.version_number,
      versionId: plan.version.id,
      changed: true,
      facilityGrantCount: plan.grants.length,
    };
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    await releaseUserAccessRebuildLease(
      userId,
      leaseOwner,
      operationError instanceof Error ? operationError.message : null,
    );
  }
};
