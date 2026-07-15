import type { Role, User, UserWarehouseRole } from "@bduck/shared-types";
import { assertUsableLoginUser } from "./loginUserPolicy.js";
import { getEffectiveRolePermissions } from "./rolePermissionUtils.js";
import { resolveRoleAssignmentScopeKey } from "./roleAssignmentValidity.js";
import { activeRoleAssignments, uniqueRoleIds } from "./scopedRoleAccess.js";

export const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 14;

export interface AuthSessionResult {
  cookie: string;
  expiresIn: number;
  user: User;
  roles: UserWarehouseRole[];
  roleIds: string[];
  permissions: Record<string, unknown>;
}

export interface AuthSessionDependencies {
  verifyIdToken: (idToken: string) => Promise<{ uid: string }>;
  getUserById: (userId: string) => Promise<User | null>;
  getUserWarehouseRoles: (userId: string) => Promise<UserWarehouseRole[]>;
  getRoleById: (roleId: string) => Promise<Role | null>;
  createSessionCookie: (
    idToken: string,
    options: { expiresIn: number },
  ) => Promise<string>;
}

export const createSessionLoginWithDependencies = async (
  idToken: string,
  dependencies: AuthSessionDependencies,
  now = new Date(),
): Promise<AuthSessionResult> => {
  const decodedToken = await dependencies.verifyIdToken(idToken);
  const user = assertUsableLoginUser(
    await dependencies.getUserById(decodedToken.uid),
  );
  const activeRoles = activeRoleAssignments(
    await dependencies.getUserWarehouseRoles(user.id),
    now,
  );
  const roleIds = uniqueRoleIds(activeRoles);
  const roleDefinitions = await Promise.all(
    roleIds.map((roleId) => dependencies.getRoleById(roleId)),
  );
  const roleById = new Map(
    roleDefinitions
      .filter((role): role is Role => role !== null)
      .map((role) => [role.id, role]),
  );
  const permissions: Record<string, unknown> = {};

  activeRoles.forEach((assignment) => {
    const role = roleById.get(assignment.role_id);
    if (!role) return;

    const scope = resolveRoleAssignmentScopeKey(assignment.warehouse_id);
    if (!scope) return;
    permissions[scope] = {
      ...(permissions[scope] as Record<string, unknown> | undefined),
      ...getEffectiveRolePermissions(role),
    };
  });

  // Create the credential only after the authoritative user and active role
  // state have passed every check above.
  const cookie = await dependencies.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  return {
    cookie,
    expiresIn: SESSION_EXPIRES_IN_MS,
    user,
    roles: activeRoles,
    roleIds,
    permissions,
  };
};
