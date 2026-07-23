import {
  AuditAction,
  EmployeeEmploymentStatus,
  UserStatus,
} from "@bduck/shared-types";
import type { EmployeeProfile } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import {
  createEmployeeProfileAndSyncUser,
  findEmployeeProfileByCode,
  findEmployeeProfilesScoped,
  getEmployeeProfileById,
  getEmployeeProfileByUserId,
  softDeleteEmployeeProfileRecord,
  updateEmployeeProfileAndUserWorkplace,
} from "../repositories/employeeProfileRepository.js";
import {
  getUserById,
  getUserWarehouseRoles,
} from "../repositories/userRepository.js";
import {
  createEmployeeProfileSchema,
  updateEmployeeProfileSchema,
} from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { createUser, type CreateUserResult } from "./userService.js";
import { AuthorizationService } from "./authorization/index.js";
import { assertCanAccessTargetUser } from "./userTargetPolicy.js";
import { rebuildUserAccessForUsers } from "./userAccessRebuildService.js";
import { buildEmployeeProfilePayload as buildProfilePayload } from "./employeeProfilePayload.js";
import { validateEmployeeEmploymentProfile } from "./employeeEmploymentPolicy.js";

type CreateEmployeeProfileInput = z.infer<typeof createEmployeeProfileSchema>;
type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>;

export interface CreateEmployeeProfileResult {
  profile: EmployeeProfile;
  account: CreateUserResult | null;
}

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Hồ sơ nhân viên không tồn tại hoặc đã bị xóa.",
    zh: "员工档案不存在或已被删除。",
  },
};

const conflictError = (messageVi: string, messageZh: string) => ({
  statusCode: 409,
  messages: {
    vi: messageVi,
    zh: messageZh,
  },
});

const employmentDateFields = [
  "probation_start_date",
  "probation_end_date",
  "official_start_date",
  "resignation_date",
] as const;

const hasEmploymentDateInput = (input: object): boolean =>
  employmentDateFields.some((field) => field in input);

const assertEmploymentProfileIsValid = (
  profile: Pick<
    EmployeeProfile,
    | "employment_status"
    | "probation_start_date"
    | "probation_end_date"
    | "official_start_date"
    | "resignation_date"
  >,
) => {
  const validationIssue = validateEmployeeEmploymentProfile(profile)[0];
  if (!validationIssue) return;
  throw {
    statusCode: 400,
    messages: validationIssue.messages,
    field: validationIssue.field,
  };
};

const assertUniqueProfileFields = async (
  input: Partial<Pick<EmployeeProfile, "employee_code" | "user_id">>,
  currentProfileId?: string,
) => {
  if (input.employee_code) {
    const existing = await findEmployeeProfileByCode(input.employee_code);
    if (existing && existing.id !== currentProfileId) {
      throw conflictError(
        `Mã nhân viên "${input.employee_code}" đã tồn tại.`,
        `员工编号 "${input.employee_code}" 已存在。`,
      );
    }
  }

  if (input.user_id) {
    const existing = await getEmployeeProfileByUserId(input.user_id);
    if (existing && existing.id !== currentProfileId) {
      throw conflictError(
        "Tài khoản này đã được liên kết với một hồ sơ nhân viên khác.",
        "该账户已关联到其他员工档案。",
      );
    }
  }
};

const assertLinkedUserExists = async (userId: string | null | undefined) => {
  if (!userId) return;
  const user = await getUserById(userId);
  if (!user || user.is_deleted) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Tài khoản liên kết không tồn tại hoặc đã bị xóa.",
        zh: "关联账户不存在或已被删除。",
      },
    };
  }
};

export const fetchEmployeeProfiles = async (
  authorization: AuthorizationService,
): Promise<EmployeeProfile[]> =>
  findEmployeeProfilesScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("employees.read"),
  });

export const fetchEmployeeProfileById = async (
  profileId: string,
  authorization: AuthorizationService,
): Promise<EmployeeProfile> => {
  const profile = await getEmployeeProfileById(profileId);
  if (!profile) throw notFoundError;
  authorization.assert("employees.read", profile.workplace_warehouse_id);
  return profile;
};

export const fetchEmployeeProfileByUserId = async (
  userId: string,
): Promise<EmployeeProfile | null> => getEmployeeProfileByUserId(userId);

export const createEmployeeProfile = async (
  input: CreateEmployeeProfileInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<CreateEmployeeProfileResult> => {
  authorization.assert("employees.write", input.workplace_warehouse_id);
  if (
    input.employment_status !== undefined &&
    input.employment_status !== EmployeeEmploymentStatus.UNSPECIFIED
  ) {
    authorization.assert(
      "employees.employment.manage",
      input.workplace_warehouse_id,
    );
  } else if (hasEmploymentDateInput(input)) {
    authorization.assert(
      "employees.employment.manage",
      input.workplace_warehouse_id,
    );
  }
  assertEmploymentProfileIsValid(input);
  await assertUniqueProfileFields({
    employee_code: input.employee_code,
    user_id: input.user_id ?? undefined,
  });
  await assertLinkedUserExists(input.user_id);
  if (input.user_id) {
    const linkedUser = await getUserById(input.user_id);
    if (linkedUser) {
      const assignments = await getUserWarehouseRoles(linkedUser.id);
      assertCanAccessTargetUser(
        authorization,
        "users.write",
        linkedUser,
        assignments,
      );
      authorization.assert("users.write", input.workplace_warehouse_id);
    }
  }

  let account: CreateUserResult | null = null;
  let linkedUserId = input.user_id ?? null;

  if (input.create_account && input.account) {
    account = await createUser(
      {
        email: input.account.email,
        full_name: input.full_name,
        employee_id: input.employee_code,
        workplace_facility_id: input.workplace_warehouse_id,
        status: input.account.status ?? UserStatus.ACTIVE,
        assignments: input.account.assignments ?? [],
      },
      actorId,
      authorization,
      auditMetadata,
      { createEmployeeProfile: false },
    );
    linkedUserId = account.user.id;
  }

  const profile = await createEmployeeProfileAndSyncUser(randomUUID(), {
    ...(buildProfilePayload(input) as Omit<
      EmployeeProfile,
      "id" | "created_at" | "updated_at" | "is_deleted"
    >),
    user_id: linkedUserId,
  });

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
  if (profile.user_id) {
    await rebuildUserAccessForUsers(
      [profile.user_id],
      "EMPLOYEE_PROFILE_CREATED",
      actorId,
    );
  }

  return { profile, account };
};

export const updateEmployeeProfile = async (
  profileId: string,
  input: UpdateEmployeeProfileInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<EmployeeProfile> => {
  const existing = await getEmployeeProfileById(profileId);
  if (!existing) throw notFoundError;
  authorization.assert("employees.write", existing.workplace_warehouse_id);
  if (input.workplace_warehouse_id) {
    authorization.assert("employees.write", input.workplace_warehouse_id);
  }
  if (
    input.employment_status !== undefined &&
    input.employment_status !==
      (existing.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED)
  ) {
    throw conflictError(
      "Hãy dùng chức năng chuyển trạng thái lao động để giữ đầy đủ lịch sử.",
      "请使用劳动状态转换功能，以保留完整历史记录。",
    );
  }
  if (hasEmploymentDateInput(input)) {
    authorization.assert(
      "employees.employment.manage",
      input.workplace_warehouse_id ?? existing.workplace_warehouse_id,
    );
  }
  assertEmploymentProfileIsValid({ ...existing, ...input });
  await assertUniqueProfileFields(
    {
      employee_code: input.employee_code,
      user_id: input.user_id ?? undefined,
    },
    profileId,
  );
  await assertLinkedUserExists(input.user_id);
  if (input.user_id && input.user_id !== existing.user_id) {
    const linkedUser = await getUserById(input.user_id);
    if (linkedUser) {
      assertCanAccessTargetUser(
        authorization,
        "users.write",
        linkedUser,
        await getUserWarehouseRoles(linkedUser.id),
      );
      authorization.assert(
        "users.write",
        input.workplace_warehouse_id ?? existing.workplace_warehouse_id,
      );
    }
  }

  const updateData = Object.fromEntries(
    Object.entries(buildProfilePayload(input)).filter(
      ([, value]) => value !== undefined,
    ),
  ) as Parameters<typeof updateEmployeeProfileAndUserWorkplace>[2];

  await updateEmployeeProfileAndUserWorkplace(
    profileId,
    input.user_id !== undefined ? input.user_id : existing.user_id,
    updateData,
  );
  const updated = await getEmployeeProfileById(profileId);
  if (!updated) throw notFoundError;

  await logAudit({
    entity_type: "employee_profiles",
    entity_id: profileId,
    warehouse_id: updated.workplace_warehouse_id,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: updated as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  await rebuildUserAccessForUsers(
    [existing.user_id, updated.user_id].filter((userId): userId is string =>
      Boolean(userId),
    ),
    "EMPLOYEE_PROFILE_UPDATED",
    actorId,
  );

  return updated;
};

export const deleteEmployeeProfile = async (
  profileId: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await getEmployeeProfileById(profileId);
  if (!existing) throw notFoundError;
  authorization.assert("employees.write", existing.workplace_warehouse_id);
  await softDeleteEmployeeProfileRecord(profileId);

  await logAudit({
    entity_type: "employee_profiles",
    entity_id: profileId,
    warehouse_id: existing.workplace_warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: actorId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
  if (existing.user_id) {
    await rebuildUserAccessForUsers(
      [existing.user_id],
      "EMPLOYEE_PROFILE_SOFT_DELETED",
      actorId,
    );
  }
};
