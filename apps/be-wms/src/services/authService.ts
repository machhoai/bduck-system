import { auth } from "../config/firebase.js";
import {
  getUserById,
  getUserWarehouseRoles,
} from "../repositories/userRepository.js";
import { findUserByUsername } from "../repositories/userRepository.js";
import { findEmployeeProfilesByPhone } from "../repositories/employeeProfileRepository.js";
import {
  createSessionLoginWithDependencies,
  type AuthSessionResult,
} from "./authSessionFlow.js";
import { isUsableLoginUser } from "./loginUserPolicy.js";
import { ensureSessionUserAccessWithDependencies } from "./authAccessBootstrapService.js";
import { loadMaterializedAccessContext } from "./materializedAccessContextService.js";
import { materializeUserAccess } from "./userAccessMaterializationService.js";

export type { AuthSessionResult } from "./authSessionFlow.js";

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
): Promise<AuthSessionResult> =>
  createSessionLoginWithDependencies(idToken, {
    verifyIdToken: (token) => auth.verifyIdToken(token),
    getUserById,
    getUserWarehouseRoles,
    ensureUserAccess: (userId) =>
      ensureSessionUserAccessWithDependencies(userId, {
        loadAccessContext: loadMaterializedAccessContext,
        materializeAccess: materializeUserAccess,
      }),
    createSessionCookie: (token, options) =>
      auth.createSessionCookie(token, options),
  });

export const logoutSession = async (sessionCookie: string): Promise<void> => {
  // We only clear the cookie for the current session.
  // The user explicitly requested NOT to revoke all refresh tokens.
  // So there is nothing to do in Firebase Admin. The controller will just clear the HTTP cookie.
};
