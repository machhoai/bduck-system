import type { Role } from "@bduck/shared-types";
import {
  AuthorizationService,
  authorizationError,
} from "./authorization/index.js";

const enabledPermissionKeys = (role: Pick<Role, "permissions">): string[] =>
  Object.entries(role.permissions).flatMap(([permission, enabled]) =>
    permission.trim().length > 0 && enabled === true ? [permission] : [],
  );

/**
 * Prevents an actor from granting a facility, global scope, or action that is
 * broader than their own effective grant. Role documents are global, so this
 * policy is enforced at every assignment mutation.
 */
export const assertCanDelegateRole = (
  authorization: AuthorizationService,
  facilityId: string | null,
  role: Pick<Role, "permissions">,
): void => {
  if (facilityId === null) {
    if (!authorization.context.isSystemAdmin) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
    return;
  }

  if (!authorization.can("users.assign_role", facilityId)) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
  const actorGrant = authorization.context.grants[facilityId];
  if (!actorGrant) throw authorizationError("AUTHORIZATION_DENIED");

  for (const permission of enabledPermissionKeys(role)) {
    if (
      permission === "*" ||
      (actorGrant.permissions["*"] !== true &&
        actorGrant.permissions[permission] !== true)
    ) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
  }
};
