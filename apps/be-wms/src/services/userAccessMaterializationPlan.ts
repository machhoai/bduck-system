import { createHash } from "node:crypto";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  type FacilityAccessGrantSource,
  type UserAccessMetadata,
  type UserAccessVersion,
  type UserFacilityAccessGrant,
  type WarehouseType,
} from "@bduck/shared-types";
import type { AccessContext } from "./authorization/index.js";

export interface MaterializedGrantSeed {
  facilityId: string;
  facilityType: WarehouseType;
  permissions: Readonly<Record<string, boolean>>;
  sources: readonly FacilityAccessGrantSource[];
}

export interface MaterializedAccessSeed {
  actorId: string;
  workplaceFacilityId: string | null;
  isSystemAdmin: boolean;
  systemAdminSources: readonly FacilityAccessGrantSource[];
  policyVersion: string;
  grants: readonly MaterializedGrantSeed[];
}

export interface MaterializationPlanInput {
  seed: MaterializedAccessSeed;
  versionNumber: number;
  computedBy: string;
  actionTime: Date;
  syncTime: Date;
  existingMetadata: UserAccessMetadata | null;
  versionId?: string;
}

export interface ExistingMaterializedVersion {
  id: string;
  status: UserAccessVersion["status"];
  source_fingerprint: string;
}

export interface MaterializedVersionResolution {
  versionId: string;
  staleBuildingVersionIds: string[];
}

const normalizedSources = (sources: readonly FacilityAccessGrantSource[]) =>
  sources
    .map((source) => ({
      type: source.type,
      role_id: source.role_id,
      assignment_id: source.assignment_id,
      office_id: source.office_id,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );

const canonicalSeed = (seed: MaterializedAccessSeed) => ({
  actor_id: seed.actorId,
  workplace_facility_id: seed.workplaceFacilityId,
  is_system_admin: seed.isSystemAdmin,
  system_admin_sources: normalizedSources(seed.systemAdminSources),
  policy_version: seed.policyVersion,
  grants: [...seed.grants]
    .map((grant) => ({
      facility_id: grant.facilityId,
      facility_type: grant.facilityType,
      permissions: Object.entries(grant.permissions)
        .filter(([, enabled]) => enabled === true)
        .sort(([left], [right]) => left.localeCompare(right)),
      sources: normalizedSources(grant.sources),
    }))
    .sort((left, right) => left.facility_id.localeCompare(right.facility_id)),
});

export const createAccessSourceFingerprint = (
  seed: MaterializedAccessSeed,
): string =>
  createHash("sha256")
    .update(JSON.stringify(canonicalSeed(seed)))
    .digest("hex");

export const resolveMaterializedVersion = (
  versionNumber: number,
  sourceFingerprint: string,
  existingVersions: readonly ExistingMaterializedVersion[],
): MaterializedVersionResolution => {
  const matchingBuilding = existingVersions.find(
    (version) =>
      version.status === "BUILDING" &&
      version.source_fingerprint === sourceFingerprint,
  );
  const staleBuildingVersionIds = existingVersions
    .filter(
      (version) =>
        version.status === "BUILDING" && version.id !== matchingBuilding?.id,
    )
    .map((version) => version.id);
  const failedMatchingCount = existingVersions.filter(
    (version) =>
      version.status === "FAILED" &&
      version.source_fingerprint === sourceFingerprint,
  ).length;
  const baseVersionId = `access-v${versionNumber}-${sourceFingerprint.slice(0, 24)}`;

  return {
    versionId:
      matchingBuilding?.id ??
      (failedMatchingCount > 0
        ? `${baseVersionId}-r${failedMatchingCount + 1}`
        : baseVersionId),
    staleBuildingVersionIds,
  };
};

export const materializedSeedFromContext = (
  context: AccessContext,
): MaterializedAccessSeed => ({
  actorId: context.actorId,
  workplaceFacilityId: context.workplaceFacilityId,
  isSystemAdmin: context.isSystemAdmin,
  systemAdminSources: context.systemAdminSources,
  policyVersion: context.policyVersion,
  grants: Object.values(context.grants).map((grant) => ({
    facilityId: grant.facilityId,
    facilityType: grant.facilityType,
    permissions: grant.permissions,
    sources: grant.sources,
  })),
});

export const emptyMaterializedSeed = (
  actorId: string,
  workplaceFacilityId: string | null,
): MaterializedAccessSeed => ({
  actorId,
  workplaceFacilityId,
  isSystemAdmin: false,
  systemAdminSources: [],
  policyVersion: FACILITY_ACCESS_POLICY_VERSION,
  grants: [],
});

export const createUserAccessMaterializationPlan = ({
  seed,
  versionNumber,
  computedBy,
  actionTime,
  syncTime,
  existingMetadata,
  versionId: requestedVersionId,
}: MaterializationPlanInput): {
  metadata: UserAccessMetadata;
  version: UserAccessVersion;
  grants: UserFacilityAccessGrant[];
} => {
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) {
    throw new Error("USER_ACCESS_VERSION_NUMBER_INVALID");
  }
  const sourceFingerprint = createAccessSourceFingerprint(seed);
  const versionId =
    requestedVersionId ??
    `access-v${versionNumber}-${sourceFingerprint.slice(0, 24)}`;
  if (!versionId.trim() || versionId !== versionId.trim()) {
    throw new Error("USER_ACCESS_VERSION_ID_INVALID");
  }
  const timestamps = {
    created_at: syncTime,
    updated_at: syncTime,
    action_time: actionTime,
    sync_time: syncTime,
  };
  const grants = seed.grants.map<UserFacilityAccessGrant>((grant) => ({
    id: grant.facilityId,
    user_id: seed.actorId,
    facility_id: grant.facilityId,
    facility_type: grant.facilityType,
    warehouse_id: grant.facilityId,
    permissions: { ...grant.permissions },
    sources: normalizedSources(grant.sources),
    access_version_id: versionId,
    access_version: versionNumber,
    computed_at: syncTime,
    is_deleted: false,
    ...timestamps,
  }));
  const metadata: UserAccessMetadata = {
    id: seed.actorId,
    user_id: seed.actorId,
    workplace_facility_id: seed.workplaceFacilityId,
    workplace_warehouse_id: seed.workplaceFacilityId,
    is_global_admin: seed.isSystemAdmin,
    system_admin_sources: normalizedSources(seed.systemAdminSources),
    active_version_id: versionId,
    access_version: versionNumber,
    policy_version: seed.policyVersion,
    source_fingerprint: sourceFingerprint,
    facility_grant_count: grants.length,
    computed_at: syncTime,
    computed_by: computedBy,
    migration_version: null,
    is_deleted: false,
    ...timestamps,
    created_at: existingMetadata?.created_at ?? syncTime,
  };
  const version: UserAccessVersion = {
    id: versionId,
    user_id: seed.actorId,
    version_number: versionNumber,
    status: "BUILDING",
    policy_version: seed.policyVersion,
    source_fingerprint: sourceFingerprint,
    workplace_facility_id: seed.workplaceFacilityId,
    workplace_warehouse_id: seed.workplaceFacilityId,
    is_global_admin: seed.isSystemAdmin,
    system_admin_sources: normalizedSources(seed.systemAdminSources),
    facility_grant_count: grants.length,
    computed_at: syncTime,
    computed_by: computedBy,
    activated_at: null,
    retired_at: null,
    migration_version: null,
    is_deleted: false,
    ...timestamps,
  };
  return { metadata, version, grants };
};
