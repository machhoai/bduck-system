import { RoleName } from "@bduck/shared-types";

export interface RequestUserContext {
  id: string;
  permissions?: Record<string, Record<string, unknown>>;
  roleNames?: RoleName[];
}

export const getAccessibleWarehouseIds = (
  user: RequestUserContext,
): string[] | undefined => {
  const permissions = user.permissions || {};
  const globalPerms = permissions.global || {};

  if (globalPerms["*"] === true || globalPerms["warehouses.read"] === true) {
    return undefined;
  }

  return Object.entries(permissions)
    .filter(([scope, scopedPermissions]) => {
      if (scope === "global") return false;
      return (
        scopedPermissions["*"] === true ||
        scopedPermissions["warehouses.read"] === true
      );
    })
    .map(([scope]) => scope);
};

export const canSetLocationQuarantine = (user: RequestUserContext): boolean => {
  const globalPerms = user.permissions?.global || {};
  if (globalPerms["*"] === true) return true;

  return Boolean(
    user.roleNames?.some(
      (role) => role === RoleName.ADMIN || role === RoleName.WAREHOUSE_MANAGER,
    ),
  );
};

export const canReadWarehouse = (
  user: RequestUserContext,
  warehouseId: string,
): boolean => {
  const permissions = user.permissions || {};
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms["warehouses.read"] === true) {
    return true;
  }

  const scopedPermissions = permissions[warehouseId] || {};
  return (
    scopedPermissions["*"] === true ||
    scopedPermissions["warehouses.read"] === true
  );
};
