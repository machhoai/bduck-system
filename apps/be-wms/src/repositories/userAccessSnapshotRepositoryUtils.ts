import {
  USER_ACCESS_COLLECTION,
  USER_ACCESS_FACILITIES_SUBCOLLECTION,
  USER_ACCESS_VERSIONS_SUBCOLLECTION,
  type UserAccessMetadata,
  type UserAccessVersion,
  type UserFacilityAccessGrant,
} from "@bduck/shared-types";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";
import type { UserAccessSnapshotWritePlan } from "./userAccessRepository.js";

const REQUIRED_DATE_FIELDS = [
  "computed_at",
  "created_at",
  "updated_at",
  "action_time",
  "sync_time",
];

export const mapUserAccessMetadata = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
) => mapFirestoreDocument<UserAccessMetadata>(snapshot, REQUIRED_DATE_FIELDS);

export const mapUserAccessVersion = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
) =>
  mapFirestoreDocument<UserAccessVersion>(snapshot, REQUIRED_DATE_FIELDS, [
    "activated_at",
    "retired_at",
  ]);

export const mapUserFacilityAccessGrant = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
) =>
  mapFirestoreDocument<UserFacilityAccessGrant>(snapshot, REQUIRED_DATE_FIELDS);

export const assertSnapshotWritePlanReferences = (
  plan: UserAccessSnapshotWritePlan,
): void => {
  const versionPath = `${USER_ACCESS_COLLECTION}/${plan.metadata.user_id}/${USER_ACCESS_VERSIONS_SUBCOLLECTION}/${plan.version.id}`;
  if (
    plan.metadataRef.path !==
      `${USER_ACCESS_COLLECTION}/${plan.metadata.user_id}` ||
    plan.versionRef.path !== versionPath ||
    plan.grants.some(
      ({ ref, data }) =>
        ref.path !==
        `${versionPath}/${USER_ACCESS_FACILITIES_SUBCOLLECTION}/${data.facility_id}`,
    )
  ) {
    throw new Error("USER_ACCESS_SNAPSHOT_REFERENCE_MISMATCH");
  }
};

const normalizedSources = (grant: UserFacilityAccessGrant) =>
  grant.sources
    .map((source) => ({
      assignment_id: source.assignment_id,
      office_id: source.office_id,
      role_id: source.role_id,
      type: source.type,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );

const normalizedAdminSources = (
  value: UserAccessMetadata | UserAccessVersion,
) =>
  JSON.stringify(
    [
      ...(Array.isArray(value.system_admin_sources)
        ? value.system_admin_sources
        : []),
    ]
      .map((source) => ({
        assignment_id: source.assignment_id,
        office_id: source.office_id,
        role_id: source.role_id,
        type: source.type,
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  );

const hasValidAdminSourceManifest = (
  value: UserAccessMetadata | UserAccessVersion,
) => {
  const sources = Array.isArray(value.system_admin_sources)
    ? value.system_admin_sources
    : [];
  return value.is_global_admin
    ? sources.length > 0 &&
        sources.every(
          (source) =>
            source.type === "SYSTEM_GLOBAL" && source.office_id === null,
        )
    : sources.length === 0;
};

const grantManifest = (grant: UserFacilityAccessGrant) =>
  JSON.stringify({
    access_version: grant.access_version,
    access_version_id: grant.access_version_id,
    facility_id: grant.facility_id,
    facility_type: grant.facility_type,
    id: grant.id,
    is_deleted: grant.is_deleted,
    permissions: Object.entries(grant.permissions).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
    sources: normalizedSources(grant),
    user_id: grant.user_id,
    warehouse_id: grant.warehouse_id ?? null,
  });

export const assertUserAccessSnapshotPlan = (
  metadata: UserAccessMetadata,
  version: UserAccessVersion,
  grants: UserFacilityAccessGrant[],
): void => {
  const count = grants.length;
  if (
    metadata.id !== metadata.user_id ||
    version.user_id !== metadata.user_id ||
    metadata.active_version_id !== version.id ||
    metadata.access_version !== version.version_number ||
    metadata.policy_version !== version.policy_version ||
    metadata.source_fingerprint !== version.source_fingerprint ||
    !version.source_fingerprint ||
    metadata.workplace_facility_id !== version.workplace_facility_id ||
    metadata.is_global_admin !== version.is_global_admin ||
    !hasValidAdminSourceManifest(metadata) ||
    !hasValidAdminSourceManifest(version) ||
    normalizedAdminSources(metadata) !== normalizedAdminSources(version) ||
    metadata.facility_grant_count !== count ||
    version.facility_grant_count !== count ||
    metadata.is_deleted ||
    version.is_deleted ||
    version.status !== "BUILDING"
  ) {
    throw new Error("USER_ACCESS_SNAPSHOT_PLAN_MISMATCH");
  }

  const facilityIds = new Set<string>();
  grants.forEach((grant) => {
    if (
      grant.user_id !== metadata.user_id ||
      grant.id !== grant.facility_id ||
      grant.access_version_id !== version.id ||
      grant.access_version !== version.version_number ||
      grant.is_deleted ||
      facilityIds.has(grant.facility_id)
    ) {
      throw new Error("USER_ACCESS_GRANT_SNAPSHOT_MISMATCH");
    }
    facilityIds.add(grant.facility_id);
  });
};

export const assertStoredVersionMatchesPlan = (
  stored: UserAccessVersion,
  expected: UserAccessVersion,
  grantCount: number,
): void => {
  if (
    stored.id !== expected.id ||
    stored.user_id !== expected.user_id ||
    stored.version_number !== expected.version_number ||
    stored.policy_version !== expected.policy_version ||
    stored.source_fingerprint !== expected.source_fingerprint ||
    stored.workplace_facility_id !== expected.workplace_facility_id ||
    stored.is_global_admin !== expected.is_global_admin ||
    !hasValidAdminSourceManifest(stored) ||
    normalizedAdminSources(stored) !== normalizedAdminSources(expected) ||
    stored.facility_grant_count !== grantCount ||
    stored.is_deleted
  ) {
    throw new Error("USER_ACCESS_VERSION_SNAPSHOT_MISMATCH");
  }
};

export const assertGrantMatchesPlan = (
  stored: UserFacilityAccessGrant,
  expected: UserFacilityAccessGrant,
): void => {
  if (grantManifest(stored) !== grantManifest(expected)) {
    throw new Error("USER_ACCESS_GRANT_MANIFEST_MISMATCH");
  }
};

export const assertCompleteGrantManifest = (
  stored: UserFacilityAccessGrant[],
  expected: UserFacilityAccessGrant[],
): void => {
  if (stored.length !== expected.length) {
    throw new Error("USER_ACCESS_SNAPSHOT_INCOMPLETE");
  }
  const expectedByFacility = new Map(
    expected.map((grant) => [grant.facility_id, grant]),
  );

  stored.forEach((grant) => {
    const expectedGrant = expectedByFacility.get(grant.facility_id);
    if (!expectedGrant) throw new Error("USER_ACCESS_GRANT_MANIFEST_MISMATCH");
    assertGrantMatchesPlan(grant, expectedGrant);
    expectedByFacility.delete(grant.facility_id);
  });
  if (expectedByFacility.size) {
    throw new Error("USER_ACCESS_SNAPSHOT_INCOMPLETE");
  }
};

export const assertPartialGrantManifest = (
  stored: UserFacilityAccessGrant[],
  expected: UserFacilityAccessGrant[],
): void => {
  if (stored.length > expected.length) {
    throw new Error("USER_ACCESS_GRANT_MANIFEST_MISMATCH");
  }
  const expectedByFacility = new Map(
    expected.map((grant) => [grant.facility_id, grant]),
  );
  stored.forEach((grant) => {
    const expectedGrant = expectedByFacility.get(grant.facility_id);
    if (!expectedGrant) throw new Error("USER_ACCESS_GRANT_MANIFEST_MISMATCH");
    assertGrantMatchesPlan(grant, expectedGrant);
  });
};

export const assertActiveMetadataMatchesVersion = (
  metadata: UserAccessMetadata | null,
  version: UserAccessVersion,
): void => {
  if (
    !metadata ||
    metadata.is_deleted ||
    metadata.id !== version.user_id ||
    metadata.user_id !== version.user_id ||
    metadata.active_version_id !== version.id ||
    metadata.access_version !== version.version_number ||
    metadata.policy_version !== version.policy_version ||
    metadata.source_fingerprint !== version.source_fingerprint ||
    metadata.workplace_facility_id !== version.workplace_facility_id ||
    metadata.is_global_admin !== version.is_global_admin ||
    !hasValidAdminSourceManifest(metadata) ||
    !hasValidAdminSourceManifest(version) ||
    normalizedAdminSources(metadata) !== normalizedAdminSources(version) ||
    metadata.facility_grant_count !== version.facility_grant_count
  ) {
    throw new Error("USER_ACCESS_ACTIVE_VERSION_POINTER_MISMATCH");
  }
};
