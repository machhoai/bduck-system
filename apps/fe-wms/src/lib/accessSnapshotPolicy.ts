import {
  FACILITY_ACCESS_POLICY_VERSION,
  type UserAccessMetadata,
  type UserFacilityAccessGrant,
} from "@bduck/shared-types";

export type ClientPermissionMap = Record<string, Record<string, boolean>>;
export type ActiveAccessMetadata = UserAccessMetadata & {
  active_version_id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseActiveAccessMetadata(
  userId: string,
  value: unknown,
): ActiveAccessMetadata | null {
  if (!isRecord(value)) return null;
  if (value.user_id !== userId || value.is_deleted !== false) return null;
  if (value.policy_version !== FACILITY_ACCESS_POLICY_VERSION) return null;
  if (
    typeof value.active_version_id !== "string" ||
    !value.active_version_id.trim()
  ) {
    return null;
  }
  if (
    typeof value.access_version !== "number" ||
    !Number.isSafeInteger(value.access_version) ||
    value.access_version < 1
  ) {
    return null;
  }
  if (
    typeof value.facility_grant_count !== "number" ||
    !Number.isSafeInteger(value.facility_grant_count) ||
    value.facility_grant_count < 0 ||
    typeof value.is_global_admin !== "boolean"
  ) {
    return null;
  }
  return value as unknown as ActiveAccessMetadata;
}

function validateGrant(
  metadata: UserAccessMetadata,
  grant: UserFacilityAccessGrant,
) {
  return (
    grant.user_id === metadata.user_id &&
    grant.is_deleted === false &&
    grant.id === grant.facility_id &&
    grant.access_version === metadata.access_version &&
    grant.access_version_id === metadata.active_version_id &&
    typeof grant.facility_id === "string" &&
    grant.facility_id.length > 0 &&
    isRecord(grant.permissions)
  );
}

export function buildMaterializedPermissions(
  metadata: UserAccessMetadata,
  grants: readonly UserFacilityAccessGrant[],
): ClientPermissionMap {
  if (grants.length !== metadata.facility_grant_count) {
    throw new Error("USER_ACCESS_GRANT_COUNT_MISMATCH");
  }
  const permissions: ClientPermissionMap = metadata.is_global_admin
    ? { global: { "*": true } }
    : {};
  const facilityIds = new Set<string>();

  for (const grant of grants) {
    if (!validateGrant(metadata, grant)) {
      throw new Error("USER_ACCESS_GRANT_VERSION_MISMATCH");
    }
    if (facilityIds.has(grant.facility_id)) {
      throw new Error("USER_ACCESS_GRANT_DUPLICATE_FACILITY");
    }
    facilityIds.add(grant.facility_id);
    permissions[grant.facility_id] = Object.fromEntries(
      Object.entries(grant.permissions).filter(([, enabled]) => enabled === true),
    );
  }
  return permissions;
}

export function needsGrantReload(
  current: {
    accessStatus: string;
    accessVersion: number | null;
    activeAccessVersionId: string | null;
  },
  metadata: UserAccessMetadata,
) {
  return (
    current.accessStatus !== "READY" ||
    current.accessVersion !== metadata.access_version ||
    current.activeAccessVersionId !== metadata.active_version_id
  );
}
