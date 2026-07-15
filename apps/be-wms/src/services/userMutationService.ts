import { AuditAction, UserStatus } from "@bduck/shared-types";
import type { z } from "zod";
import { auth } from "../config/firebase.js";
import {
  getEmployeeProfileByUserId,
  softDeleteEmployeeProfileRecord,
  updateEmployeeProfileAndUserWorkplace,
} from "../repositories/employeeProfileRepository.js";
import {
  deactivateUserWarehouseRoles,
  getUserWarehouseRoles,
  replaceManagedUserWarehouseRoles,
  setUniqueUsername,
  softDeleteUserRecord,
  updateUserRecord,
  UsernameAlreadyExistsError,
} from "../repositories/userRepository.js";
import { updateUserSchema } from "../utils/zodSchemas.js";
import { sendInitialPasswordSetupInvitation } from "./accountInvitationService.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { AuthorizationService } from "./authorization/index.js";
import { buildAuthorizedAssignments } from "./userAssignmentService.js";
import {
  assertUniqueUserFields,
  assertWorkplaceWrite,
  userConflictError,
} from "./userMutationSupport.js";
import { assertCanAccessTargetUser } from "./userTargetPolicy.js";
import {
  createUserView,
  loadUserRecord,
  sanitizeUserRecord,
} from "./userReadService.js";

export * from "./userCreationService.js";

type UpdateUserInput = z.infer<typeof updateUserSchema>;

const syncProfileWorkplace = async (
  userId: string,
  workplaceId: string,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const profile = await getEmployeeProfileByUserId(userId);
  if (!profile || profile.workplace_warehouse_id === workplaceId) return;
  await updateEmployeeProfileAndUserWorkplace(profile.id, userId, {
    workplace_warehouse_id: workplaceId,
  });
  await logAudit({
    entity_type: "employee_profiles",
    entity_id: profile.id,
    warehouse_id: workplaceId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: profile as unknown as Record<string, unknown>,
    new_value: { ...profile, workplace_warehouse_id: workplaceId },
    ...auditMetadata,
  });
};

export const updateUser = async (
  userId: string,
  input: UpdateUserInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadUserRecord(userId);
  const existingAssignments = await getUserWarehouseRoles(userId);
  assertCanAccessTargetUser(
    authorization,
    "users.write",
    existing,
    existingAssignments,
  );
  if (input.workplace_facility_id !== undefined) {
    assertWorkplaceWrite(authorization, input.workplace_facility_id);
  }
  await assertUniqueUserFields(
    { email: input.email, employee_id: input.employee_id },
    userId,
  );
  const nextAssignments = input.assignments
    ? await buildAuthorizedAssignments(
        userId,
        actorId,
        input.assignments,
        authorization,
      )
    : null;

  if (input.username !== undefined) {
    try {
      await setUniqueUsername(userId, input.username);
    } catch (error) {
      if (error instanceof UsernameAlreadyExistsError) {
        throw userConflictError("username", input.username);
      }
      throw error;
    }
  }
  await auth.updateUser(userId, {
    email: input.email,
    password: input.password,
    displayName: input.full_name,
    disabled: input.status ? input.status !== UserStatus.ACTIVE : undefined,
  });
  const updateData = Object.fromEntries(
    Object.entries({
      email: input.email,
      full_name: input.full_name,
      employee_id: input.employee_id,
      status: input.status,
      workplace_facility_id: input.workplace_facility_id,
    }).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(updateData).length > 0) {
    await updateUserRecord(userId, updateData);
  }
  if (nextAssignments) {
    await replaceManagedUserWarehouseRoles(userId, nextAssignments, {
      isSystemAdmin: authorization.context.isSystemAdmin,
      facilityIds: authorization.facilityIdsFor("users.assign_role"),
    });
  }
  if (typeof input.workplace_facility_id === "string") {
    await syncProfileWorkplace(
      userId,
      input.workplace_facility_id,
      actorId,
      auditMetadata,
    );
  }

  const updated = await loadUserRecord(userId);
  const updatedAssignments = await getUserWarehouseRoles(userId);
  await logAudit({
    entity_type: "users",
    entity_id: userId,
    warehouse_id: updated.workplace_facility_id ?? null,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: sanitizeUserRecord(existing) as Record<string, unknown>,
    new_value: createUserView(
      updated,
      updatedAssignments,
      authorization,
    ) as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

export const sendUserInvitation = async (
  userId: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<{ expires_at: Date }> => {
  const user = await loadUserRecord(userId);
  const assignments = await getUserWarehouseRoles(userId);
  assertCanAccessTargetUser(authorization, "users.write", user, assignments);
  return sendInitialPasswordSetupInvitation(user, actorId, auditMetadata);
};

export const deleteUser = async (
  userId: string,
  actorId: string,
  authorization: AuthorizationService,
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
  const existing = await loadUserRecord(userId);
  const assignments = await getUserWarehouseRoles(userId);
  assertCanAccessTargetUser(
    authorization,
    "users.write",
    existing,
    assignments,
  );
  const profile = await getEmployeeProfileByUserId(userId);

  await auth.updateUser(userId, { disabled: true });
  await softDeleteUserRecord(userId);
  await deactivateUserWarehouseRoles(userId);
  if (profile) await softDeleteEmployeeProfileRecord(profile.id);

  await logAudit({
    entity_type: "users",
    entity_id: userId,
    warehouse_id: existing.workplace_facility_id ?? null,
    action: AuditAction.SOFT_DELETE,
    user_id: actorId,
    old_value: sanitizeUserRecord(existing) as Record<string, unknown>,
    new_value: { is_deleted: true, status: UserStatus.INACTIVE },
    ...auditMetadata,
  });
};
