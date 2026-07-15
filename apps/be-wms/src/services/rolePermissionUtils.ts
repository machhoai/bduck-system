import type { Role } from "@bduck/shared-types";

export const getEffectiveRolePermissions = (role: Role) => {
  // Role names are labels, never authorization facts. System-wide access is
  // granted only when the persisted permission map explicitly contains `*`.
  return { ...role.permissions };
};
