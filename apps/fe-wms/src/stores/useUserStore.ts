import { create } from "zustand";
import type {
  User,
  UserAccessRuntimeStatus,
  UserWarehouseRole,
} from "@bduck/shared-types";
import type { ClientAuthRuntimeStatus } from "@/lib/authNavigationPolicy";

type PermissionMap = Record<string, Record<string, unknown>>;

interface UserState {
  user: User | null;
  permissions: PermissionMap;
  roleIds: string[];
  roleAssignments: UserWarehouseRole[];
  isAuthenticated: boolean;
  authStatus: ClientAuthRuntimeStatus;
  accessStatus: UserAccessRuntimeStatus;
  accessVersion: number | null;
  activeAccessVersionId: string | null;
  accessEpoch: number;
  lastAccessServerSyncAt: string | null;
  setAuthData: (
    user: User,
    roleIds?: string[],
    roleAssignments?: UserWarehouseRole[],
  ) => void;
  beginAuthVerification: (firebaseUserId: string) => void;
  setRoleAssignments: (roleAssignments: UserWarehouseRole[]) => void;
  beginAccessRefresh: (
    accessVersion: number | null,
    activeAccessVersionId: string | null,
  ) => void;
  applyAccessSnapshot: (
    accessVersion: number,
    activeAccessVersionId: string,
    permissions: PermissionMap,
  ) => void;
  markAccessOffline: () => void;
  revokeAccess: (
    status?: Extract<UserAccessRuntimeStatus, "REVOKED" | "ERROR">,
  ) => void;
  clearAuth: () => void;
  hasPermission: (action: string, warehouseId?: string) => boolean;
  hasScopedRole: (
    roleId: string | null | undefined,
    warehouseId?: string | null,
    options?: { allowGlobalFallback?: boolean; requireGlobal?: boolean },
  ) => boolean;
}

function isAssignmentActive(assignment: UserWarehouseRole, now = new Date()) {
  if (!assignment.is_active) return false;
  const validFrom = assignment.valid_from
    ? new Date(assignment.valid_from)
    : null;
  if (validFrom && validFrom.getTime() > now.getTime()) return false;
  const validUntil = assignment.valid_until
    ? new Date(assignment.valid_until)
    : null;
  return !validUntil || validUntil.getTime() >= now.getTime();
}

const emptyAccessState = {
  permissions: {},
  accessVersion: null,
  activeAccessVersionId: null,
  lastAccessServerSyncAt: null,
} as const;

export const useUserStore = create<UserState>()((set, get) => ({
  user: null,
  roleIds: [],
  roleAssignments: [],
  isAuthenticated: false,
  authStatus: "INITIALIZING",
  accessStatus: "SIGNED_OUT",
  accessEpoch: 0,
  ...emptyAccessState,

  beginAuthVerification: (firebaseUserId) =>
    set((state) => {
      const sameUser = state.user?.id === firebaseUserId;
      if (sameUser) return { authStatus: "VERIFYING" };

      return {
        user: null,
        roleIds: [],
        roleAssignments: [],
        isAuthenticated: false,
        authStatus: "VERIFYING",
        accessStatus: "VERIFYING",
        accessEpoch: state.accessEpoch + 1,
        ...emptyAccessState,
      };
    }),

  setAuthData: (user, roleIds = [], roleAssignments = []) =>
    set((state) => {
      const sameUser = state.user?.id === user.id;
      return {
        user,
        roleIds,
        roleAssignments,
        isAuthenticated: true,
        authStatus: "AUTHENTICATED",
        permissions: sameUser ? state.permissions : {},
        accessStatus: sameUser ? state.accessStatus : "VERIFYING",
        accessVersion: sameUser ? state.accessVersion : null,
        activeAccessVersionId: sameUser ? state.activeAccessVersionId : null,
        lastAccessServerSyncAt: sameUser ? state.lastAccessServerSyncAt : null,
        accessEpoch: sameUser ? state.accessEpoch : state.accessEpoch + 1,
      };
    }),

  setRoleAssignments: (roleAssignments) =>
    set({
      roleAssignments,
      roleIds: Array.from(
        new Set(roleAssignments.map((assignment) => assignment.role_id)),
      ),
    }),

  beginAccessRefresh: (accessVersion, activeAccessVersionId) =>
    set((state) => ({
      permissions: {},
      accessStatus: "VERIFYING",
      accessVersion,
      activeAccessVersionId,
      lastAccessServerSyncAt: null,
      accessEpoch: state.accessEpoch + 1,
    })),

  applyAccessSnapshot: (accessVersion, activeAccessVersionId, permissions) =>
    set((state) => ({
      permissions,
      accessStatus: "READY",
      accessVersion,
      activeAccessVersionId,
      lastAccessServerSyncAt: new Date().toISOString(),
      accessEpoch: state.accessEpoch + 1,
    })),

  markAccessOffline: () =>
    set((state) => {
      const hasVerifiedAccess =
        state.accessStatus === "READY" ||
        state.accessStatus === "OFFLINE_READY";
      return {
        accessStatus: hasVerifiedAccess
          ? "OFFLINE_READY"
          : "OFFLINE_UNVERIFIED",
        permissions: hasVerifiedAccess ? state.permissions : {},
      };
    }),

  revokeAccess: (status = "REVOKED") =>
    set((state) => ({
      ...emptyAccessState,
      accessStatus: status,
      accessEpoch: state.accessEpoch + 1,
    })),

  clearAuth: () =>
    set((state) => ({
      user: null,
      roleIds: [],
      roleAssignments: [],
      isAuthenticated: false,
      authStatus: "SIGNED_OUT",
      accessStatus: "SIGNED_OUT",
      accessEpoch: state.accessEpoch + 1,
      ...emptyAccessState,
    })),

  hasPermission: (action, warehouseId) => {
    const { permissions } = get();
    const globalPermissions = permissions.global || {};
    if (globalPermissions["*"] === true) return true;
    if (globalPermissions[action] === true) return true;
    if (warehouseId) {
      const scopedPermissions = permissions[warehouseId] || {};
      return (
        scopedPermissions["*"] === true || scopedPermissions[action] === true
      );
    }
    return Object.entries(permissions).some(
      ([scope, scopedPermissions]) =>
        scope !== "global" &&
        (scopedPermissions["*"] === true || scopedPermissions[action] === true),
    );
  },

  hasScopedRole: (roleId, warehouseId, options = {}) => {
    if (!roleId) return false;
    return get()
      .roleAssignments.filter((assignment) => isAssignmentActive(assignment))
      .some((assignment) => {
        if (assignment.role_id !== roleId) return false;
        const isGlobal =
          assignment.warehouse_id == null || assignment.warehouse_id === "";
        if (options.requireGlobal) return isGlobal;
        if (warehouseId) {
          return (
            assignment.warehouse_id === warehouseId ||
            (options.allowGlobalFallback === true && isGlobal)
          );
        }
        return isGlobal;
      });
  },
}));
