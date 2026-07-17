import {
  getUserAccessMetadata,
  getUserAccessVersion,
  findUserFacilityAccessGrants,
} from "../repositories/userAccessRepository.js";
import { assertActiveMetadataMatchesVersion } from "../repositories/userAccessSnapshotRepositoryUtils.js";
import {
  createAccessContext,
  type AccessContext,
} from "./authorization/index.js";
import { createAccessSourceFingerprint } from "./userAccessMaterializationPlan.js";

export const loadMaterializedAccessContext = async (
  userId: string,
): Promise<AccessContext | null> => {
  const metadata = await getUserAccessMetadata(userId);
  if (!metadata?.active_version_id) return null;
  const version = await getUserAccessVersion(
    userId,
    metadata.active_version_id,
  );
  if (!version || version.status !== "ACTIVE") return null;
  assertActiveMetadataMatchesVersion(metadata, version);
  const grants = await findUserFacilityAccessGrants(userId, version.id);
  if (
    grants.length !== metadata.facility_grant_count ||
    grants.some(
      (grant) =>
        grant.access_version !== metadata.access_version ||
        grant.access_version_id !== version.id,
    )
  ) {
    throw new Error("USER_ACCESS_MATERIALIZED_GRANT_MISMATCH");
  }
  const seed = {
    actorId: userId,
    workplaceFacilityId: metadata.workplace_facility_id,
    isSystemAdmin: metadata.is_global_admin,
    systemAdminSources: metadata.system_admin_sources,
    policyVersion: metadata.policy_version,
    grants: grants.map((grant) => ({
      facilityId: grant.facility_id,
      facilityType: grant.facility_type,
      permissions: grant.permissions,
      sources: grant.sources,
    })),
  };
  if (createAccessSourceFingerprint(seed) !== metadata.source_fingerprint) {
    throw new Error("USER_ACCESS_MATERIALIZED_FINGERPRINT_MISMATCH");
  }
  if (!metadata.workplace_facility_id && !metadata.is_global_admin) return null;
  return createAccessContext({
    actorId: seed.actorId,
    workplaceFacilityId: seed.workplaceFacilityId,
    isSystemAdmin: seed.isSystemAdmin,
    systemAdminSources: seed.systemAdminSources,
    policyVersion: seed.policyVersion,
    computedAt: metadata.computed_at,
    grants: seed.grants,
  });
};
