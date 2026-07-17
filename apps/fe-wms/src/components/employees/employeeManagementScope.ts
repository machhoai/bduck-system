import type { Warehouse } from "@bduck/shared-types";

export type PermissionScope = {
  global: boolean;
  warehouseIds: Set<string>;
};

export function getPermissionScope(
  permissions: Record<string, Record<string, unknown>>,
  action: string,
): PermissionScope {
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[action] === true) {
    return { global: true, warehouseIds: new Set() };
  }
  return {
    global: false,
    warehouseIds: new Set(
      Object.entries(permissions)
        .filter(
          ([scope, scopedPermissions]) =>
            scope !== "global" &&
            (scopedPermissions["*"] === true ||
              scopedPermissions[action] === true),
        )
        .map(([scope]) => scope),
    ),
  };
}

export const isWarehouseInScope = (
  warehouseId: string,
  scope: PermissionScope,
) => scope.global || scope.warehouseIds.has(warehouseId);

export const filterWarehousesByScope = (
  warehouses: Warehouse[],
  scope: PermissionScope,
) =>
  scope.global
    ? warehouses
    : warehouses.filter((warehouse) => scope.warehouseIds.has(warehouse.id));

export function ensureWarehouseIncluded(
  warehouses: Warehouse[],
  warehouse: Warehouse | undefined,
) {
  if (!warehouse || warehouses.some((item) => item.id === warehouse.id)) {
    return warehouses;
  }
  return [...warehouses, warehouse];
}
