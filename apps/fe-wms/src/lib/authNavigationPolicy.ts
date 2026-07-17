import type { UserAccessRuntimeStatus } from "@bduck/shared-types";

export const CLIENT_AUTH_RUNTIME_STATUSES = [
  "INITIALIZING",
  "VERIFYING",
  "AUTHENTICATED",
  "SIGNED_OUT",
] as const;

export type ClientAuthRuntimeStatus =
  (typeof CLIENT_AUTH_RUNTIME_STATUSES)[number];

type PermissionMap = Record<string, Record<string, unknown>>;

interface LoginRedirectState {
  authStatus: ClientAuthRuntimeStatus;
  isAuthenticated: boolean;
  accessStatus: UserAccessRuntimeStatus;
  permissions: PermissionMap;
}

export type AuthenticatedDestination = "/dashboard" | "/no-access" | null;

/**
 * Authentication and authorization finish independently. Never decide that a
 * user has no access while the materialized grant snapshot is still loading.
 */
export function resolveAuthenticatedDestination({
  authStatus,
  isAuthenticated,
  accessStatus,
  permissions,
}: LoginRedirectState): AuthenticatedDestination {
  if (authStatus !== "AUTHENTICATED" || !isAuthenticated) return null;

  if (accessStatus === "REVOKED") return "/no-access";
  if (accessStatus !== "READY" && accessStatus !== "OFFLINE_READY") {
    return null;
  }

  return Object.keys(permissions).length > 0 ? "/dashboard" : "/no-access";
}
