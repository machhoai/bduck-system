import type { UserWarehouseRole } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { roleRepository } from "../repositories/roleRepository.js";
import { createUserSchema } from "../utils/zodSchemas.js";
import { AuthorizationService } from "./authorization/index.js";
import { assertCanDelegateRole } from "./roleDelegationPolicy.js";

type UserAssignmentInput = z.infer<
  typeof createUserSchema
>["assignments"][number];

const assignmentKey = (assignment: UserAssignmentInput): string =>
  JSON.stringify([assignment.warehouse_id, assignment.role_id]);

export const buildAuthorizedAssignments = async (
  userId: string,
  assignedBy: string,
  assignments: readonly UserAssignmentInput[],
  authorization: AuthorizationService,
): Promise<Omit<UserWarehouseRole, "created_at">[]> => {
  const unique = new Map(
    assignments.map((assignment) => [assignmentKey(assignment), assignment]),
  );
  const roles = await roleRepository.findByIds(
    Array.from(unique.values(), (assignment) => assignment.role_id),
  );
  const rolesById = new Map(roles.map((role) => [role.id, role]));

  return Array.from(unique.values(), (assignment) => {
    const role = rolesById.get(assignment.role_id);
    if (!role) {
      throw {
        statusCode: 400,
        messages: {
          vi: "Vai trò được gán không tồn tại hoặc đã bị xóa.",
          zh: "分配的角色不存在或已被删除。",
        },
      };
    }
    assertCanDelegateRole(authorization, assignment.warehouse_id, role);
    return {
      id: randomUUID(),
      user_id: userId,
      warehouse_id: assignment.warehouse_id,
      role_id: assignment.role_id,
      assigned_by: assignedBy,
      valid_from: assignment.valid_from,
      valid_until: assignment.valid_until ?? null,
      is_active: assignment.is_active,
      scope_origin: "DIRECT" as const,
      is_deleted: false,
    };
  });
};

export const visibleAssignments = (
  assignments: readonly UserWarehouseRole[],
  authorization: AuthorizationService,
): UserWarehouseRole[] =>
  assignments.filter((assignment) => {
    if (authorization.context.isSystemAdmin) return true;
    return (
      assignment.warehouse_id !== null &&
      authorization.can("users.read", assignment.warehouse_id)
    );
  });
