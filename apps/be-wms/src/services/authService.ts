import { auth } from "../config/firebase.js";
import {
  getUserById,
  getUserWarehouseRoles,
  getRoleById,
} from "../repositories/userRepository.js";
import {
  UserStatus,
  type User,
  type UserWarehouseRole,
} from "@bduck/shared-types";
import { activeRoleAssignments, uniqueRoleIds } from "./scopedRoleAccess.js";
import { getEffectiveRolePermissions } from "./rolePermissionUtils.js";
import { findUserByUsername } from "../repositories/userRepository.js";
import { findEmployeeProfilesByPhone } from "../repositories/employeeProfileRepository.js";

export interface AuthSessionResult {
  cookie: string;
  expiresIn: number;
  user: User;
  roles: UserWarehouseRole[];
  roleIds: string[];
  permissions: Record<string, unknown>;
}

const isUsableLoginUser = (user: User | null): user is User =>
  Boolean(user && !user.is_deleted && user.status === UserStatus.ACTIVE);

export const resolveLoginEmail = async (
  identifier: string,
): Promise<string | null> => {
  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier) return null;

  if (normalizedIdentifier.includes("@")) {
    return normalizedIdentifier;
  }

  const usernameUser = await findUserByUsername(normalizedIdentifier);
  if (isUsableLoginUser(usernameUser)) {
    return usernameUser.email;
  }

  const matchingProfiles =
    await findEmployeeProfilesByPhone(normalizedIdentifier);
  const linkedUserIds = Array.from(
    new Set(
      matchingProfiles
        .map((profile) => profile.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  if (linkedUserIds.length !== 1) return null;
  const phoneUser = await getUserById(linkedUserIds[0]);
  return isUsableLoginUser(phoneUser) ? phoneUser.email : null;
};

export const createSessionLogin = async (
  idToken: string,
): Promise<AuthSessionResult> => {
  // 1. Verify the ID token first
  const decodedToken = await auth.verifyIdToken(idToken);

  // 2. Set session expiration to 14 days
  const expiresIn = 1000 * 60 * 60 * 24 * 14;

  // 3. Create the session cookie
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

  // 4. Get the user from DB
  const user = await getUserById(decodedToken.uid);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // 5. Get user roles
  const userRoles = await getUserWarehouseRoles(user.id);

  // 6. Merge all permissions from assigned roles
  const mergedPermissions: Record<string, unknown> = {};

  const activeRoles = activeRoleAssignments(userRoles);

  for (const userRole of activeRoles) {
    const roleDef = await getRoleById(userRole.role_id);
    if (!roleDef) continue;

    const scope = userRole.warehouse_id || "global";

    if (!mergedPermissions[scope]) {
      mergedPermissions[scope] = {};
    }

    // Merge role permissions into the scope
    mergedPermissions[scope] = {
      ...(mergedPermissions[scope] as Record<string, unknown>),
      ...getEffectiveRolePermissions(roleDef),
    };
  }

  return {
    cookie: sessionCookie,
    expiresIn,
    user,
    roles: userRoles,
    roleIds: uniqueRoleIds(activeRoles),
    permissions: mergedPermissions,
  };
};

export const logoutSession = async (sessionCookie: string): Promise<void> => {
  // We only clear the cookie for the current session.
  // The user explicitly requested NOT to revoke all refresh tokens.
  // So there is nothing to do in Firebase Admin. The controller will just clear the HTTP cookie.
};
