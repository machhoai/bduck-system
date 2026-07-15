import type { User, UserWarehouseRole } from "@bduck/shared-types";
import {
  AuthorizationService,
  authorizationError,
} from "./authorization/index.js";

const hasProtectedGlobalAssignment = (
  assignments: readonly UserWarehouseRole[],
): boolean =>
  assignments.some(
    (assignment) =>
      assignment.warehouse_id === null &&
      assignment.is_active === true &&
      assignment.is_deleted === false,
  );

export const canAccessTargetUser = (
  authorization: AuthorizationService,
  action: "users.read" | "users.write",
  user: Pick<User, "workplace_facility_id">,
  assignments: readonly UserWarehouseRole[],
): boolean => {
  if (authorization.context.isSystemAdmin) return true;
  if (hasProtectedGlobalAssignment(assignments)) return false;
  const workplaceId = user.workplace_facility_id;
  return (
    typeof workplaceId === "string" &&
    workplaceId.trim().length > 0 &&
    authorization.can(action, workplaceId)
  );
};

export const assertCanAccessTargetUser = (
  authorization: AuthorizationService,
  action: "users.read" | "users.write",
  user: Pick<User, "workplace_facility_id">,
  assignments: readonly UserWarehouseRole[],
): void => {
  if (!canAccessTargetUser(authorization, action, user, assignments)) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};
