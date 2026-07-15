import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type FacilityAccessGrantSource,
} from "@bduck/shared-types";
import { createAccessContext } from "./accessContextFactory.js";
import { authorizationError } from "./authorizationError.js";
import type {
  AccessContext,
  AccessContextGrantSeed,
  AuthorizationAssignment,
  AuthorizationFacility,
  AuthorizationRole,
  AuthorizationSourceSnapshot,
} from "./authorizationTypes.js";
import {
  isActiveActor,
  isActiveFacility,
  isActiveRole,
  isActiveValidityWindow,
} from "./authorizationValidity.js";
import { resolveManagedFacilityIds } from "./officeAccessScopeResolver.js";

const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

const isValidId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();

interface ActiveAssignment {
  assignment: AuthorizationAssignment;
  role: AuthorizationRole;
}

interface MutableGrant extends AccessContextGrantSeed {
  permissions: Record<string, boolean>;
  sources: FacilityAccessGrantSource[];
}

const buildUniqueIndex = <T extends { id: string }>(
  values: readonly T[],
): Map<string, T> => {
  const result = new Map<string, T>();
  values.forEach((value) => {
    if (!isValidId(value.id) || result.has(value.id)) {
      throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
    }
    result.set(value.id, value);
  });
  return result;
};

const addRoleGrant = (
  grants: Map<string, MutableGrant>,
  facility: AuthorizationFacility,
  role: AuthorizationRole,
  source: FacilityAccessGrantSource,
): void => {
  const enabledPermissions = Object.entries(role.permissions).filter(
    ([permission, enabled]) =>
      permission.trim().length > 0 &&
      permission === permission.trim() &&
      enabled === true,
  );
  if (enabledPermissions.length === 0) return;

  const grant = grants.get(facility.id) ?? {
    facilityId: facility.id,
    facilityType: facility.type,
    permissions: {},
    sources: [],
  };
  enabledPermissions.forEach(([permission]) => {
    grant.permissions[permission] = true;
  });
  grant.sources.push(source);
  grants.set(facility.id, grant);
};

const activeAssignmentsForActor = (
  snapshot: AuthorizationSourceSnapshot,
  rolesById: ReadonlyMap<string, AuthorizationRole>,
  now: Date,
  timeZone: string,
): ActiveAssignment[] =>
  snapshot.assignments.flatMap((assignment) => {
    if (
      assignment.user_id !== snapshot.actor?.id ||
      !isValidId(assignment.id) ||
      !isValidId(assignment.user_id) ||
      !isValidId(assignment.role_id) ||
      (assignment.warehouse_id !== null &&
        !isValidId(assignment.warehouse_id)) ||
      assignment.is_active !== true ||
      (assignment.is_deleted !== undefined &&
        assignment.is_deleted !== false) ||
      (assignment.scope_origin !== undefined &&
        assignment.scope_origin !== "DIRECT" &&
        assignment.scope_origin !== "LEGACY_DIRECT") ||
      !isActiveValidityWindow(
        assignment.valid_from,
        assignment.valid_until,
        now,
        timeZone,
      )
    ) {
      return [];
    }
    const role = rolesById.get(assignment.role_id);
    return role && isActiveRole(role, now, timeZone)
      ? [{ assignment, role }]
      : [];
  });

const systemAdminSources = (
  assignments: readonly ActiveAssignment[],
): FacilityAccessGrantSource[] =>
  assignments.flatMap(({ assignment, role }) =>
    assignment.warehouse_id === null &&
    Object.prototype.hasOwnProperty.call(role.permissions, "*") &&
    role.permissions["*"] === true
      ? [
          {
            type: "SYSTEM_GLOBAL" as const,
            role_id: role.id,
            assignment_id: assignment.id,
            office_id: null,
          },
        ]
      : [],
  );

const addDirectGrants = (
  assignments: readonly ActiveAssignment[],
  activeFacilities: ReadonlyMap<string, AuthorizationFacility>,
  grants: Map<string, MutableGrant>,
  workplaceId: string,
): void => {
  assignments.forEach(({ assignment, role }) => {
    if (assignment.warehouse_id === null) return;
    const facilityId = assignment.warehouse_id;
    if (!facilityId) return;
    const facility = activeFacilities.get(facilityId);
    if (
      !facility ||
      (facility.type === WarehouseType.OFFICE && facility.id !== workplaceId)
    ) {
      return;
    }
    addRoleGrant(grants, facility, role, {
      type: assignment.scope_origin === "DIRECT" ? "DIRECT" : "LEGACY_DIRECT",
      role_id: role.id,
      assignment_id: assignment.id,
      office_id: null,
    });
  });
};

export const buildAccessContext = (
  snapshot: AuthorizationSourceSnapshot,
): AccessContext => {
  const now = snapshot.now ?? new Date();
  const timeZone = snapshot.dateOnlyTimeZone ?? DEFAULT_TIME_ZONE;
  if (!Number.isFinite(now.getTime())) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(now);
  } catch {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }

  const actor = snapshot.actor;
  if (!actor) throw authorizationError("AUTHORIZATION_ACTOR_REQUIRED");
  if (!isValidId(actor.id) || !isActiveActor(actor)) {
    throw authorizationError("AUTHORIZATION_ACTOR_INACTIVE");
  }
  const facilitiesById = buildUniqueIndex(snapshot.facilities);
  const rolesById = buildUniqueIndex(snapshot.roles);
  const activeFacilities = new Map(
    Array.from(facilitiesById.entries()).filter(([, facility]) =>
      isActiveFacility(facility, now, timeZone),
    ),
  );
  const assignments = activeAssignmentsForActor(
    snapshot,
    rolesById,
    now,
    timeZone,
  );
  const grants = new Map<string, MutableGrant>();
  const adminSources = systemAdminSources(assignments);

  if (adminSources.length > 0) {
    activeFacilities.forEach((facility) => {
      adminSources.forEach((source) =>
        addRoleGrant(grants, facility, rolesById.get(source.role_id)!, source),
      );
    });
    const adminWorkplace = isValidId(actor.workplace_facility_id)
      ? activeFacilities.get(actor.workplace_facility_id)
      : null;
    return createAccessContext({
      actorId: actor.id,
      workplaceFacilityId: adminWorkplace?.id ?? null,
      isSystemAdmin: true,
      systemAdminSources: adminSources,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: now,
      grants: Array.from(grants.values()),
    });
  }

  const workplaceId = actor.workplace_facility_id;
  if (workplaceId === null || workplaceId === undefined) {
    throw authorizationError("AUTHORIZATION_WORKPLACE_REQUIRED");
  }
  if (!isValidId(workplaceId)) {
    throw authorizationError("AUTHORIZATION_WORKPLACE_INVALID");
  }
  const workplace = activeFacilities.get(workplaceId);
  if (!workplace) {
    throw authorizationError("AUTHORIZATION_WORKPLACE_INVALID");
  }
  addDirectGrants(assignments, activeFacilities, grants, workplaceId);

  if (workplace.type === WarehouseType.OFFICE) {
    const officeAssignments = assignments.filter(
      ({ assignment }) =>
        assignment.warehouse_id === workplaceId &&
        assignment.scope_origin === "DIRECT",
    );
    if (officeAssignments.length > 0) {
      const targets = resolveManagedFacilityIds(
        snapshot,
        workplaceId,
        activeFacilities,
        now,
        timeZone,
      );
      targets.forEach((targetId) => {
        const target = activeFacilities.get(targetId)!;
        officeAssignments.forEach(({ assignment, role }) =>
          addRoleGrant(grants, target, role, {
            type: "OFFICE_INHERITED",
            role_id: role.id,
            assignment_id: assignment.id,
            office_id: workplaceId,
          }),
        );
      });
    }
  }

  return createAccessContext({
    actorId: actor.id,
    workplaceFacilityId: workplaceId,
    isSystemAdmin: false,
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt: now,
    grants: Array.from(grants.values()),
  });
};
