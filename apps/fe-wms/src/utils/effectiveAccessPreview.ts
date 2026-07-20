import {
  ActiveStatus,
  WarehouseType,
  type FacilityAccessGrantSourceType,
  type Role,
  type UserWarehouseRoleScopeOrigin,
  type Warehouse,
} from "@bduck/shared-types";

export interface EffectiveAccessAssignmentDraft {
  warehouse_id: string;
  role_id: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  scope_origin?: UserWarehouseRoleScopeOrigin;
}

export interface EffectiveAccessPreviewGrant {
  facilityId: string;
  sourceTypes: FacilityAccessGrantSourceType[];
}

interface BuildEffectiveAccessPreviewInput {
  workplaceFacilityId: string;
  assignments: readonly EffectiveAccessAssignmentDraft[];
  roles: readonly Role[];
  facilities: readonly Warehouse[];
  inheritedFacilityIds: readonly string[];
  today?: string;
}

const currentDateInVietnam = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

const isCurrentlyActive = (
  assignment: EffectiveAccessAssignmentDraft,
  today: string,
) =>
  assignment.is_active &&
  assignment.valid_from <= today &&
  (!assignment.valid_until || assignment.valid_until >= today);

/** Mirrors accessContextBuilder for unsaved user-form values. */
export function buildEffectiveAccessPreview({
  workplaceFacilityId,
  assignments,
  roles,
  facilities,
  inheritedFacilityIds,
  today = currentDateInVietnam(),
}: BuildEffectiveAccessPreviewInput): EffectiveAccessPreviewGrant[] {
  const activeFacilities = new Map(
    facilities
      .filter(
        (facility) =>
          facility.status === ActiveStatus.ACTIVE && !facility.is_deleted,
      )
      .map((facility) => [facility.id, facility]),
  );
  const activeRoles = new Map(
    roles
      .filter(
        (role) =>
          !role.is_deleted &&
          Object.values(role.permissions).some((enabled) => enabled === true),
      )
      .map((role) => [role.id, role]),
  );
  const activeAssignments = assignments.flatMap((assignment) => {
    const role = activeRoles.get(assignment.role_id);
    return role && isCurrentlyActive(assignment, today)
      ? [{ assignment, role }]
      : [];
  });
  const systemAdminAssignments = activeAssignments.filter(
    ({ assignment, role }) =>
      !assignment.warehouse_id && role.permissions["*"] === true,
  );
  const grants = new Map<string, Set<FacilityAccessGrantSourceType>>();
  const addSource = (
    facilityId: string,
    source: FacilityAccessGrantSourceType,
  ) => {
    const sources = grants.get(facilityId) ?? new Set();
    sources.add(source);
    grants.set(facilityId, sources);
  };

  if (systemAdminAssignments.length > 0) {
    activeFacilities.forEach((facility) =>
      addSource(facility.id, "SYSTEM_GLOBAL"),
    );
  } else {
    activeAssignments.forEach(({ assignment }) => {
      if (!assignment.warehouse_id) return;
      const facility = activeFacilities.get(assignment.warehouse_id);
      if (
        !facility ||
        (facility.type === WarehouseType.OFFICE &&
          facility.id !== workplaceFacilityId)
      ) {
        return;
      }
      addSource(
        facility.id,
        assignment.scope_origin === "LEGACY_DIRECT"
          ? "LEGACY_DIRECT"
          : "DIRECT",
      );
    });

    const workplace = activeFacilities.get(workplaceFacilityId);
    const hasOfficeRole =
      workplace?.type === WarehouseType.OFFICE &&
      activeAssignments.some(
        ({ assignment }) =>
          assignment.warehouse_id === workplaceFacilityId &&
          assignment.scope_origin !== "LEGACY_DIRECT",
      );
    if (hasOfficeRole) {
      inheritedFacilityIds.forEach((facilityId) => {
        if (activeFacilities.has(facilityId)) {
          addSource(facilityId, "OFFICE_INHERITED");
        }
      });
    }
  }

  return facilities.flatMap((facility) => {
    const sourceTypes = grants.get(facility.id);
    return sourceTypes
      ? [{ facilityId: facility.id, sourceTypes: Array.from(sourceTypes) }]
      : [];
  });
}
