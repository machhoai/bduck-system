import {
  ActiveStatus,
  FACILITY_ACCESS_POLICY_VERSION,
} from "@bduck/shared-types";
import type {
  AuthorizationAssignment,
  AuthorizationOfficeScopeConfig,
  AuthorizationOfficeScopeEdge,
  AuthorizationRole,
} from "../services/authorization/authorizationTypes.js";
import {
  authorizationSourceWindowIsActive,
  isAuthorizationSourceId,
} from "./authorizationSourceMapper.js";

const assignmentIsActive = (
  assignment: AuthorizationAssignment,
  actorId: string,
  now: Date,
): boolean =>
  assignment.user_id === actorId &&
  isAuthorizationSourceId(assignment.id) &&
  isAuthorizationSourceId(assignment.role_id) &&
  assignment.is_active === true &&
  (assignment.is_deleted === undefined || assignment.is_deleted === false) &&
  (assignment.scope_origin === undefined ||
    assignment.scope_origin === "DIRECT" ||
    assignment.scope_origin === "LEGACY_DIRECT") &&
  authorizationSourceWindowIsActive(
    assignment.valid_from,
    assignment.valid_until,
    now,
  );

const roleIsActive = (role: AuthorizationRole, now: Date): boolean =>
  role.is_deleted === false &&
  (role.is_active === undefined || role.is_active === true) &&
  (role.status === undefined || role.status === ActiveStatus.ACTIVE) &&
  authorizationSourceWindowIsActive(
    role.valid_from,
    role.valid_until,
    now,
    true,
  );

export const activeDirectFacilityIds = (
  actorId: string,
  assignments: readonly AuthorizationAssignment[],
  now: Date,
): string[] =>
  Array.from(
    new Set(
      assignments
        .filter((assignment) => assignmentIsActive(assignment, actorId, now))
        .map((assignment) => assignment.warehouse_id)
        .filter(isAuthorizationSourceId),
    ),
  );

export const hasExactGlobalWildcard = (
  actorId: string,
  assignments: readonly AuthorizationAssignment[],
  roles: readonly AuthorizationRole[],
  now: Date,
): boolean => {
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  return assignments.some((assignment) => {
    const role = rolesById.get(assignment.role_id);
    return (
      assignment.warehouse_id === null &&
      assignmentIsActive(assignment, actorId, now) &&
      Boolean(role && roleIsActive(role, now) && role.permissions["*"] === true)
    );
  });
};

export const activeOfficeScopeMode = (
  config: AuthorizationOfficeScopeConfig | null,
  officeId: string,
  now: Date,
): "ALL" | "SELECTED" | null =>
  config &&
  config.id === officeId &&
  config.office_id === officeId &&
  config.is_active === true &&
  config.is_deleted === false &&
  config.policy_version === FACILITY_ACCESS_POLICY_VERSION &&
  Number.isInteger(config.revision) &&
  config.revision > 0 &&
  authorizationSourceWindowIsActive(
    config.valid_from,
    config.valid_until,
    now,
  ) &&
  (config.scope_mode === "ALL" || config.scope_mode === "SELECTED")
    ? config.scope_mode
    : null;

export const activeOfficeEdgeTargetIds = (
  edges: readonly AuthorizationOfficeScopeEdge[],
  officeId: string,
  now: Date,
): string[] =>
  Array.from(
    new Set(
      edges
        .filter(
          (edge) =>
            edge.office_id === officeId &&
            edge.is_active === true &&
            edge.is_deleted === false &&
            isAuthorizationSourceId(edge.target_facility_id) &&
            authorizationSourceWindowIsActive(
              edge.valid_from,
              edge.valid_until,
              now,
            ),
        )
        .map((edge) => edge.target_facility_id),
    ),
  );
