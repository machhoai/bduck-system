import type { UserAccessRuntimeStatus } from "@bduck/shared-types";

export const CLIENT_AUTH_RUNTIME_STATUSES = [
  "INITIALIZING",
  "VERIFYING",
  "AUTHENTICATED",
  "ERROR",
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

export interface DashboardRuntimeFailure {
  kind: "offline" | "auth" | "access";
  title: string;
  description: string;
}

export function resolveDashboardRuntimeFailure(
  authStatus: ClientAuthRuntimeStatus,
  accessStatus: UserAccessRuntimeStatus,
): DashboardRuntimeFailure | null {
  if (accessStatus === "OFFLINE_UNVERIFIED") {
    return {
      kind: "offline",
      title: "Bạn đang ngoại tuyến",
      description:
        "Kết nối lại Internet để xác minh phiên đăng nhập và quyền truy cập.",
    };
  }

  if (authStatus === "ERROR") {
    return {
      kind: "auth",
      title: "Không thể xác minh phiên đăng nhập",
      description:
        "Máy chủ xác thực chưa phản hồi hoặc phiên đăng nhập không hợp lệ. Vui lòng thử lại.",
    };
  }

  if (accessStatus === "ERROR") {
    return {
      kind: "access",
      title: "Không thể tải quyền truy cập",
      description:
        "Dịch vụ phân quyền hiện không khả dụng. Kết nối Internet của bạn vẫn có thể hoạt động bình thường.",
    };
  }

  return null;
}

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
