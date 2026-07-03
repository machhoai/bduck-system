import { AuditAction, UserStatus } from "@bduck/shared-types";
import type { User, UserWarehouseRole } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { auth } from "../config/firebase.js";
import {
  createUserRecord,
  deactivateUserWarehouseRoles,
  findUserByField,
  findUsers,
  getRoleById,
  getUserById,
  getUserWarehouseRoles,
  replaceUserWarehouseRoles,
  softDeleteUserRecord,
  updateUserRecord,
} from "../repositories/userRepository.js";
import { createUserSchema, updateUserSchema } from "../utils/zodSchemas.js";
import { sendInitialPasswordSetupInvitation } from "./accountInvitationService.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

type CreateUserInput = z.infer<typeof createUserSchema>;
type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserWithAssignments extends User {
  assignments: UserWarehouseRole[];
}

export interface CreateUserResult {
  user: UserWithAssignments;
  invitation_email_sent: boolean;
}

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Người dùng không tồn tại hoặc đã bị xóa.",
    zh: "用户不存在或已被删除。",
  },
};

const conflictError = (field: string, value: string) => ({
  statusCode: 409,
  messages: {
    vi: `${field} "${value}" đã tồn tại.`,
    zh: `${field} "${value}" 已存在。`,
  },
});

const assertUniqueUserFields = async (
  input: Partial<Pick<User, "username" | "email" | "employee_id">>,
  currentUserId?: string,
) => {
  for (const [field, value] of Object.entries(input)) {
    if (!value) continue;
    const existing = await findUserByField(
      field as "username" | "email" | "employee_id",
      value,
    );
    if (existing && existing.id !== currentUserId) {
      throw conflictError(field, value);
    }
  }
};

const buildAssignments = async (
  userId: string,
  assignedBy: string,
  assignments: CreateUserInput["assignments"],
): Promise<Omit<UserWarehouseRole, "created_at">[]> => {
  const result: Omit<UserWarehouseRole, "created_at">[] = [];
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const scopeRoleKey = `${assignment.warehouse_id ?? "global"}:${assignment.role_id}`;
    if (seen.has(scopeRoleKey)) continue;
    seen.add(scopeRoleKey);

    const role = await getRoleById(assignment.role_id);
    if (!role) {
      throw {
        statusCode: 400,
        messages: {
          vi: "Role được gán không tồn tại hoặc đã bị xóa.",
          zh: "分配的角色不存在或已被删除。",
        },
      };
    }

    result.push({
      id: randomUUID(),
      user_id: userId,
      warehouse_id: assignment.warehouse_id,
      role_id: assignment.role_id,
      assigned_by: assignedBy,
      valid_from: assignment.valid_from,
      valid_until: assignment.valid_until ?? null,
      is_active: assignment.is_active,
    });
  }

  return result;
};

const withAssignments = async (user: User): Promise<UserWithAssignments> => ({
  ...user,
  assignments: await getUserWarehouseRoles(user.id),
});

export const fetchUsers = async (): Promise<UserWithAssignments[]> => {
  const users = await findUsers();
  return Promise.all(users.map(withAssignments));
};

export const fetchUserById = async (
  userId: string,
): Promise<UserWithAssignments> => {
  const user = await getUserById(userId);
  if (!user || user.is_deleted) throw notFoundError;
  return withAssignments(user);
};

export const createUser = async (
  input: CreateUserInput,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<CreateUserResult> => {
  await assertUniqueUserFields({
    username: input.username,
    email: input.email,
    employee_id: input.employee_id,
  });

  const authUser = await auth.createUser({
    email: input.email,
    displayName: input.full_name,
    disabled: input.status !== UserStatus.ACTIVE,
  });

  try {
    const user = await createUserRecord(authUser.uid, {
      id: authUser.uid,
      username: input.username,
      email: input.email,
      password_hash: "firebase-auth",
      full_name: input.full_name,
      employee_id: input.employee_id,
      status: input.status,
    });
    const assignments = await replaceUserWarehouseRoles(
      user.id,
      await buildAssignments(user.id, actorId, input.assignments),
    );
    const created = { ...user, assignments };

    await logAudit({
      entity_type: "users",
      entity_id: user.id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: created as unknown as Record<string, unknown>,
      ...auditMetadata,
    });

    let invitationEmailSent = false;
    try {
      await sendInitialPasswordSetupInvitation(user, actorId, auditMetadata);
      invitationEmailSent = true;
    } catch (invitationError) {
      console.error("[userService] Failed to send account invitation:", {
        userId: user.id,
        error: invitationError,
      });
    }

    return {
      user: created,
      invitation_email_sent: invitationEmailSent,
    };
  } catch (error) {
    await auth.deleteUser(authUser.uid).catch(() => undefined);
    throw error;
  }
};

export const updateUser = async (
  userId: string,
  input: UpdateUserInput,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchUserById(userId);
  await assertUniqueUserFields(
    {
      username: input.username,
      email: input.email,
      employee_id: input.employee_id,
    },
    userId,
  );

  const updateData = {
    username: input.username,
    email: input.email,
    full_name: input.full_name,
    employee_id: input.employee_id,
    status: input.status,
  };
  const cleanUpdateData = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined),
  ) as Partial<
    Pick<User, "username" | "email" | "full_name" | "employee_id" | "status">
  >;

  await auth.updateUser(userId, {
    email: input.email,
    password: input.password,
    displayName: input.full_name,
    disabled: input.status ? input.status !== UserStatus.ACTIVE : undefined,
  });
  if (Object.keys(cleanUpdateData).length > 0) {
    await updateUserRecord(userId, cleanUpdateData);
  }
  if (input.assignments) {
    await replaceUserWarehouseRoles(
      userId,
      await buildAssignments(userId, actorId, input.assignments),
    );
  }

  await logAudit({
    entity_type: "users",
    entity_id: userId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: (await fetchUserById(userId)) as unknown as Record<
      string,
      unknown
    >,
    ...auditMetadata,
  });
};

export const sendUserInvitation = async (
  userId: string,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<{ expires_at: Date }> => {
  const user = await fetchUserById(userId);
  return sendInitialPasswordSetupInvitation(user, actorId, auditMetadata);
};

export const deleteUser = async (
  userId: string,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  if (userId === actorId) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Bạn không thể tự xóa mềm tài khoản đang đăng nhập.",
        zh: "不能软删除当前登录账户。",
      },
    };
  }

  const existing = await fetchUserById(userId);
  await auth.updateUser(userId, { disabled: true });
  await softDeleteUserRecord(userId);
  await deactivateUserWarehouseRoles(userId);

  await logAudit({
    entity_type: "users",
    entity_id: userId,
    action: AuditAction.SOFT_DELETE,
    user_id: actorId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true, status: UserStatus.INACTIVE },
    ...auditMetadata,
  });
};
