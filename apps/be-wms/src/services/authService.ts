import { auth } from "../config/firebase.js";
import {
  getUserById,
  getUserWarehouseRoles,
  getRoleById,
} from "../repositories/userRepository.js";
import type { User, UserWarehouseRole, Role } from "@bduck/shared-types";

export interface AuthSessionResult {
  cookie: string;
  expiresIn: number;
  user: User;
  roles: UserWarehouseRole[];
  permissions: Record<string, unknown>;
}

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

  for (const userRole of userRoles) {
    if (!userRole.is_active) continue;

    const roleDef = await getRoleById(userRole.role_id);
    if (!roleDef) continue;

    const scope = userRole.warehouse_id || "global";

    if (!mergedPermissions[scope]) {
      mergedPermissions[scope] = {};
    }

    // Merge role permissions into the scope
    mergedPermissions[scope] = {
      ...(mergedPermissions[scope] as Record<string, unknown>),
      ...roleDef.permissions,
    };
  }

  return {
    cookie: sessionCookie,
    expiresIn,
    user,
    roles: userRoles,
    permissions: mergedPermissions,
  };
};

export const logoutSession = async (sessionCookie: string): Promise<void> => {
  // We only clear the cookie for the current session.
  // The user explicitly requested NOT to revoke all refresh tokens.
  // So there is nothing to do in Firebase Admin. The controller will just clear the HTTP cookie.
};
