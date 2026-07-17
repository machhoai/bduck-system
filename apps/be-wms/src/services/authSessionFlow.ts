import type { User, UserWarehouseRole } from "@bduck/shared-types";
import { assertUsableLoginUser } from "./loginUserPolicy.js";
import { activeRoleAssignments, uniqueRoleIds } from "./scopedRoleAccess.js";

export const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 14;

export interface AuthSessionResult {
  cookie: string;
  expiresIn: number;
  user: User;
  roles: UserWarehouseRole[];
  roleIds: string[];
}

export interface AuthSessionDependencies {
  verifyIdToken: (idToken: string) => Promise<{ uid: string }>;
  getUserById: (userId: string) => Promise<User | null>;
  getUserWarehouseRoles: (userId: string) => Promise<UserWarehouseRole[]>;
  ensureUserAccess: (userId: string) => Promise<unknown>;
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
  await dependencies.ensureUserAccess(user.id);
  // Create the credential only after identity, roles and the materialized
  // authorization snapshot have passed every check above.
  const cookie = await dependencies.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  return {
    cookie,
    expiresIn: SESSION_EXPIRES_IN_MS,
    user,
    roles: activeRoles,
    roleIds,
  };
};
