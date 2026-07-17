import type { AccessContext } from "./authorization/index.js";
import { authorizationError } from "./authorization/index.js";

export interface AuthAccessBootstrapDependencies {
  loadAccessContext: (userId: string) => Promise<AccessContext | null>;
  materializeAccess: (userId: string, computedBy: string) => Promise<unknown>;
}

const tryLoadAccessContext = async (
  userId: string,
  dependencies: AuthAccessBootstrapDependencies,
): Promise<AccessContext | null> => {
  try {
    return await dependencies.loadAccessContext(userId);
  } catch {
    return null;
  }
};

/**
 * Ensures a usable materialized snapshot exists before a session is issued.
 * Rebuilding is idempotent and only runs when the fast-path read is absent or
 * invalid, so login cannot succeed with an unusable authorization state.
 */
export const ensureSessionUserAccessWithDependencies = async (
  userId: string,
  dependencies: AuthAccessBootstrapDependencies,
): Promise<AccessContext> => {
  const existing = await tryLoadAccessContext(userId, dependencies);
  if (existing) return existing;

  await dependencies.materializeAccess(userId, userId);
  const rebuilt = await tryLoadAccessContext(userId, dependencies);
  if (!rebuilt) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }
  return rebuilt;
};
