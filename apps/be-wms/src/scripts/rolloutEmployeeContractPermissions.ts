import type { Role } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { roleRepository } from "../repositories/roleRepository.js";
import { findActiveUserIdsByRoleId } from "../repositories/userRepository.js";
import { updateRole } from "../services/roleService.js";
import { rebuildUserAccessForUsers } from "../services/userAccessRebuildService.js";
import { assertConfirmedApply } from "./employeeContractScriptGuard.js";

const HR_ROLE_NAME = "Quản lý nhân sự";
const SELF_READ_PERMISSION = "employees.contracts.self.read";
const HR_PERMISSIONS = [
  "employees.contracts.read",
  "employees.contracts.manage",
  "employees.contracts.terminate",
  "employees.contracts.documents.read",
  "employees.contracts.documents.manage",
  "employees.contracts.history.import",
] as const;

interface RoleChange {
  role: Role;
  added_permissions: string[];
  next_permissions: Record<string, boolean>;
}

const buildRoleChange = (
  role: Role,
  permissions: readonly string[],
): RoleChange | null => {
  const added = permissions.filter(
    (permission) => role.permissions[permission] !== true,
  );
  if (added.length === 0) return null;
  return {
    role,
    added_permissions: added,
    next_permissions: Object.fromEntries([
      ...Object.entries(role.permissions),
      ...added.map((permission) => [permission, true] as const),
    ]),
  };
};

const main = async () => {
  const guard = assertConfirmedApply();
  const [roles, assignmentsSnapshot] = await Promise.all([
    roleRepository.findAll(false),
    db
      .collection("user_warehouse_roles")
      .where("is_deleted", "==", false)
      .get(),
  ]);
  const assignedRoleIds = new Set(
    assignmentsSnapshot.docs.flatMap((document) => {
      const data = document.data();
      return data.is_active === true && typeof data.role_id === "string"
        ? [data.role_id]
        : [];
    }),
  );
  const hrRoles = roles.filter((role) => role.name === HR_ROLE_NAME);
  if (hrRoles.length !== 1) {
    throw new Error(`EXPECTED_EXACTLY_ONE_HR_ROLE:${hrRoles.length}`);
  }

  const changes = roles.flatMap((role) => {
    if (!assignedRoleIds.has(role.id)) return [];
    const permissions =
      role.id === hrRoles[0].id
        ? [SELF_READ_PERMISSION, ...HR_PERMISSIONS]
        : [SELF_READ_PERMISSION];
    const change = buildRoleChange(role, permissions);
    return change ? [change] : [];
  });
  console.log(
    JSON.stringify(
      {
        mode: guard.apply ? "APPLY" : "DRY_RUN",
        project_id: guard.projectId,
        changed_roles: changes.map((change) => ({
          id: change.role.id,
          name: change.role.name,
          added_permissions: change.added_permissions,
        })),
      },
      null,
      2,
    ),
  );
  if (!guard.apply) return;

  const affectedUserIds = new Set<string>();
  for (const change of changes) {
    await updateRole(
      change.role.id,
      { permissions: change.next_permissions },
      guard.initiatedBy,
      { action_time: new Date() },
    );
    for (const userId of await findActiveUserIdsByRoleId(change.role.id)) {
      affectedUserIds.add(userId);
    }
  }
  const rebuild = await rebuildUserAccessForUsers(
    [...affectedUserIds],
    "EMPLOYEE_CONTRACT_PERMISSION_ROLLOUT",
    guard.initiatedBy,
  );
  console.log(
    JSON.stringify(
      {
        mode: "APPLY_RESULT",
        updated_roles: changes.length,
        rebuilt_users: rebuild.completed,
        rebuild_failures: rebuild.failed,
      },
      null,
      2,
    ),
  );
  if (rebuild.failed.length > 0) process.exitCode = 2;
};

main().catch((error) => {
  console.error(
    "[rolloutEmployeeContractPermissions]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
