import {
  AuditAction,
  UserStatus,
  type EmployeeProfile,
  type User,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { auth } from "../config/firebase.js";
import {
  createEmployeeProfileRecord,
  findEmployeeProfileByCode,
} from "../repositories/employeeProfileRepository.js";
import {
  createUserRecord,
  deactivateUserWarehouseRoles,
  replaceUserWarehouseRoles,
  softDeleteUserRecord,
} from "../repositories/userRepository.js";
import { createUserSchema } from "../utils/zodSchemas.js";
import { sendInitialPasswordSetupInvitation } from "./accountInvitationService.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { AuthorizationService } from "./authorization/index.js";
import { buildAuthorizedAssignments } from "./userAssignmentService.js";
import {
  assertUniqueUserFields,
  assertWorkplaceWrite,
  employeeProfileStatusForUser,
  userConflictError,
} from "./userMutationSupport.js";
import { createUserView, type UserWithAssignments } from "./userReadService.js";

type CreateUserInput = z.infer<typeof createUserSchema>;

export interface CreateUserResult {
  user: UserWithAssignments;
  invitation_email_sent: boolean;
}

export interface CreateUserOptions {
  createEmployeeProfile?: boolean;
}

const createDefaultProfile = async (
  user: User,
  workplaceId: string,
): Promise<EmployeeProfile> =>
  createEmployeeProfileRecord(randomUUID(), {
    user_id: user.id,
    employee_code: user.employee_id,
    full_name: user.full_name,
    email: user.email,
    phone: null,
    job_title: null,
    department: null,
    workplace_warehouse_id: workplaceId,
    status: employeeProfileStatusForUser(user.status),
    notes: null,
  });

export const createUser = async (
  input: CreateUserInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
  options: CreateUserOptions = {},
): Promise<CreateUserResult> => {
  assertWorkplaceWrite(authorization, input.workplace_facility_id);
  await assertUniqueUserFields({
    email: input.email,
    employee_id: input.employee_id,
  });
  if (
    options.createEmployeeProfile !== false &&
    (await findEmployeeProfileByCode(input.employee_id))
  ) {
    throw userConflictError("employee_id", input.employee_id);
  }

  const authUser = await auth.createUser({
    email: input.email,
    displayName: input.full_name,
    disabled: input.status !== UserStatus.ACTIVE,
  });
  let persistedUser: User | null = null;
  try {
    const assignments = await buildAuthorizedAssignments(
      authUser.uid,
      actorId,
      input.assignments,
      authorization,
    );
    persistedUser = await createUserRecord(authUser.uid, {
      id: authUser.uid,
      username: input.username ?? "",
      email: input.email,
      password_hash: "firebase-auth",
      full_name: input.full_name,
      employee_id: input.employee_id,
      workplace_facility_id: input.workplace_facility_id,
      status: input.status,
    });
    const createdAssignments = await replaceUserWarehouseRoles(
      persistedUser.id,
      assignments,
    );
    const profile =
      options.createEmployeeProfile !== false && input.workplace_facility_id
        ? await createDefaultProfile(persistedUser, input.workplace_facility_id)
        : null;
    const created = createUserView(
      persistedUser,
      createdAssignments,
      authorization,
    );

    await logAudit({
      entity_type: "users",
      entity_id: persistedUser.id,
      warehouse_id: input.workplace_facility_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: created as unknown as Record<string, unknown>,
      ...auditMetadata,
    });
    if (profile) {
      await logAudit({
        entity_type: "employee_profiles",
        entity_id: profile.id,
        warehouse_id: profile.workplace_warehouse_id,
        action: AuditAction.CREATE,
        user_id: actorId,
        old_value: null,
        new_value: profile as unknown as Record<string, unknown>,
        ...auditMetadata,
      });
    }

    let invitationEmailSent = false;
    try {
      await sendInitialPasswordSetupInvitation(
        persistedUser,
        actorId,
        auditMetadata,
      );
      invitationEmailSent = true;
    } catch (error) {
      console.error("[userService] Failed to send account invitation:", {
        userId: persistedUser.id,
        error,
      });
    }
    return { user: created, invitation_email_sent: invitationEmailSent };
  } catch (error) {
    if (persistedUser) {
      await Promise.allSettled([
        softDeleteUserRecord(persistedUser.id),
        deactivateUserWarehouseRoles(persistedUser.id),
      ]);
    }
    await auth.deleteUser(authUser.uid).catch(() => undefined);
    throw error;
  }
};
