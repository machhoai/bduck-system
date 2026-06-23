import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserWarehouseRole } from "@bduck/shared-types";

interface UserState {
  user: User | null;
  permissions: Record<string, Record<string, unknown>>;
  /** List of role_ids the current user holds (across all warehouses) */
  roleIds: string[];
  /** Active role assignments with warehouse/global scope. */
  roleAssignments: UserWarehouseRole[];
  isAuthenticated: boolean;

  // Actions
  setAuthData: (
    user: User,
    permissions: Record<string, Record<string, unknown>>,
    roleIds?: string[],
    roleAssignments?: UserWarehouseRole[],
  ) => void;
  clearAuth: () => void;

  // Selectors
  hasPermission: (action: string, warehouseId?: string) => boolean;
  hasScopedRole: (
    roleId: string | null | undefined,
    warehouseId?: string | null,
    options?: { allowGlobalFallback?: boolean; requireGlobal?: boolean },
  ) => boolean;
}

function isAssignmentActive(assignment: UserWarehouseRole, now = new Date()) {
  if (!assignment.is_active) return false;

  const validFrom = assignment.valid_from ? new Date(assignment.valid_from) : null;
  if (validFrom && validFrom.getTime() > now.getTime()) return false;

  const validUntil = assignment.valid_until ? new Date(assignment.valid_until) : null;
  if (validUntil && validUntil.getTime() < now.getTime()) return false;

  return true;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      permissions: {},
      roleIds: [],
      roleAssignments: [],
      isAuthenticated: false,

      setAuthData: (user, permissions, roleIds = [], roleAssignments = []) =>
        set({ user, permissions, roleIds, roleAssignments, isAuthenticated: true }),

      clearAuth: () =>
        set({
          user: null,
          permissions: {},
          roleIds: [],
          roleAssignments: [],
          isAuthenticated: false,
        }),

      hasPermission: (action: string, warehouseId?: string) => {
        const { permissions } = get();
        if (!permissions) return false;

        const globalPerms = permissions["global"] || {};

        // 1. Admin bypass
        if (globalPerms["*"] === true) return true;

        // 2. Global specific permission
        if (globalPerms[action] === true) return true;

        // 3. Warehouse specific permission
        if (warehouseId) {
          const warehousePerms = permissions[warehouseId] || {};
          if (warehousePerms["*"] === true || warehousePerms[action] === true)
            return true;
        }

        if (!warehouseId) {
          return Object.entries(permissions).some(
            ([scope, scopedPermissions]) => {
              if (scope === "global") return false;
              return (
                scopedPermissions["*"] === true ||
                scopedPermissions[action] === true
              );
            },
          );
        }

        return false;
      },

      hasScopedRole: (roleId, warehouseId, options = {}) => {
        if (!roleId) return false;
        const { roleAssignments } = get();
        return roleAssignments.filter((assignment) => isAssignmentActive(assignment)).some((assignment) => {
          if (assignment.role_id !== roleId) return false;
          const isAssignmentGlobal = assignment.warehouse_id == null || assignment.warehouse_id === "";

          if (options.requireGlobal) return isAssignmentGlobal;
          
          if (warehouseId != null && warehouseId !== "") {
            return (
              assignment.warehouse_id === warehouseId ||
              (options.allowGlobalFallback === true && isAssignmentGlobal)
            );
          }
          return isAssignmentGlobal;
        });
      },
    }),
    {
      name: "wms-auth-storage",
      // We only persist non-sensitive or necessary data for fast re-render.
      // Firebase auth state listener is the source of truth, but this helps prevent UI flicker.
    },
  ),
);
