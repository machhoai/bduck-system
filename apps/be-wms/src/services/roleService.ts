import { AuditAction } from "@bduck/shared-types";
import type { Role } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { roleRepository } from "../repositories/roleRepository.js";
import { createRoleSchema, updateRoleSchema } from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

type CreateRoleInput = z.infer<typeof createRoleSchema>;
type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Role không tồn tại hoặc đã bị xóa.",
    zh: "角色不存在或已被删除。",
  },
};

const assertUniqueName = async (name: string, currentRoleId?: string) => {
  const existing = await roleRepository.findByName(name);
  if (existing && existing.id !== currentRoleId) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Role "${name}" đã tồn tại.`,
        zh: `角色 "${name}" 已存在。`,
      },
    };
  }
};

const assertValidParent = async (
  roleId: string | null,
  parentId?: string | null,
) => {
  if (!parentId) return;

  if (parentId === roleId) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể đặt role là cha của chính nó.",
        zh: "不能将角色设置为自身的父级。",
      },
    };
  }

  const parent = await roleRepository.findById(parentId);
  if (!parent || parent.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Role cha không tồn tại.",
        zh: "父级角色不存在。",
      },
    };
  }

  if (!roleId) return;

  const descendants = await roleRepository.getDescendantIds(roleId);
  if (descendants.includes(parentId)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể chuyển role vào role con của chính nó.",
        zh: "不能将角色移动到自身的子级下。",
      },
    };
  }
};

export const fetchRoles = async (): Promise<Role[]> => {
  return roleRepository.findAll(false);
};

export const fetchRoleById = async (id: string): Promise<Role> => {
  const role = await roleRepository.findById(id);
  if (!role || role.is_deleted) {
    throw notFoundError;
  }

  return role;
};

export const createRole = async (
  input: CreateRoleInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<Role> => {
  await assertUniqueName(input.name);
  await assertValidParent(null, input.parent_id || null);

  const id = randomUUID();
  const role = await roleRepository.create(id, {
    id,
    name: input.name,
    description: input.description || null,
    color: input.color,
    parent_id: input.parent_id || null,
    permissions: input.permissions || {},
    board_position: input.board_position || null,
  });

  await logAudit({
    entity_type: "roles",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: role as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return role;
};

export const updateRole = async (
  id: string,
  input: UpdateRoleInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchRoleById(id);

  if (input.name && input.name !== existing.name) {
    await assertUniqueName(input.name, id);
  }

  if (input.parent_id !== undefined && input.parent_id !== existing.parent_id) {
    await assertValidParent(id, input.parent_id);
  }

  await roleRepository.update(id, input);

  await logAudit({
    entity_type: "roles",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

export const deleteRole = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchRoleById(id);

  if (await roleRepository.hasActiveChildren(id)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa role đang có role con. Hãy di chuyển hoặc xóa role con trước.",
        zh: "无法删除仍有子角色的角色。请先移动或删除子角色。",
      },
    };
  }

  if (await roleRepository.hasActiveAssignments(id)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa role đang được gán cho tài khoản.",
        zh: "无法删除已分配给账户的角色。",
      },
    };
  }

  await roleRepository.softDelete(id);

  await logAudit({
    entity_type: "roles",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};

export const isAncestorRole = async (
  ancestorRoleId: string,
  descendantRoleId: string,
): Promise<boolean> => {
  const descendants = await roleRepository.getDescendantIds(ancestorRoleId);
  return descendants.includes(descendantRoleId);
};
