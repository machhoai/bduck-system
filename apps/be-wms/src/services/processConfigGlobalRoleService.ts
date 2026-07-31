import { roleRepository } from "../repositories/roleRepository.js";
import { getUsersByIds } from "../repositories/userRepository.js";
import { getRoleAssignmentsByRoleIds } from "../repositories/userRoleAssignmentRepository.js";

import { findMissingActiveGlobalRoleIds } from "./processConfigScopePolicy.js";

export async function assertRolesHaveActiveGlobalAssignments(
  roleIds: readonly string[],
): Promise<void> {
  if (roleIds.length === 0) return;

  const assignments = await getRoleAssignmentsByRoleIds(roleIds);
  const activeUsers = await getUsersByIds(
    assignments.map((assignment) => assignment.user_id),
  );
  const missingRoleIds = findMissingActiveGlobalRoleIds(
    roleIds,
    assignments,
    new Set(activeUsers.map((user) => user.id)),
    new Date(),
  );
  if (missingRoleIds.length === 0) return;

  const roles = await roleRepository.findByIds(missingRoleIds);
  const roleNames = missingRoleIds.map(
    (roleId) => roles.find((role) => role.id === roleId)?.name ?? roleId,
  );
  throw {
    statusCode: 422,
    messages: {
      vi: `Không thể lưu phạm vi GLOBAL vì role ${roleNames.join(", ")} chưa có người dùng active được gán role global.`,
      zh: `无法保存 GLOBAL 范围，因为角色 ${roleNames.join(", ")} 尚未分配给有效的全局用户。`,
    },
  };
}
