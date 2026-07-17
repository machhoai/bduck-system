export type PermissionMap = Record<string, Record<string, unknown>>;

export interface FacilityPermissionScope {
  isSystemAdmin: boolean;
  facilityIds: string[];
}

export function getFacilityPermissionScope(
  permissions: PermissionMap | null | undefined,
  actions: readonly string[],
): FacilityPermissionScope {
  if (!permissions) return { isSystemAdmin: false, facilityIds: [] };
  const globalPermissions = permissions.global || {};
  if (globalPermissions["*"] === true) {
    return { isSystemAdmin: true, facilityIds: [] };
  }

  return {
    isSystemAdmin: false,
    facilityIds: Object.entries(permissions)
      .filter(
        ([facilityId, scopedPermissions]) =>
          facilityId !== "global" &&
          (scopedPermissions["*"] === true ||
            actions.some((action) => scopedPermissions[action] === true)),
      )
      .map(([facilityId]) => facilityId)
      .sort(),
  };
}

export function getAnyFacilityScope(
  permissions: PermissionMap | null | undefined,
): FacilityPermissionScope {
  if (!permissions) return { isSystemAdmin: false, facilityIds: [] };
  if (permissions.global?.["*"] === true) {
    return { isSystemAdmin: true, facilityIds: [] };
  }
  return {
    isSystemAdmin: false,
    facilityIds: Object.entries(permissions)
      .filter(
        ([facilityId, scopedPermissions]) =>
          facilityId !== "global" &&
          Object.values(scopedPermissions).some((enabled) => enabled === true),
      )
      .map(([facilityId]) => facilityId)
      .sort(),
  };
}

export function scopeContainsFacility(
  scope: FacilityPermissionScope,
  facilityId: string,
) {
  return scope.isSystemAdmin || scope.facilityIds.includes(facilityId);
}
