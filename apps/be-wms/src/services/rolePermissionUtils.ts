import type { Role } from "@bduck/shared-types";

const ADMIN_ROLE_NAMES = new Set(["ADMIN", "SUPER_ADMIN"]);

export const getEffectiveRolePermissions = (role: Role) => {
  const normalizedName = role.name.trim().toUpperCase();

  if (ADMIN_ROLE_NAMES.has(normalizedName)) {
    return {
      ...role.permissions,
      "*": true,
    };
  }

  return role.permissions;
};
