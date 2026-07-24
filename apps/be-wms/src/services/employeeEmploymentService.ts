import {
  AuditAction,
  EmployeeEmploymentStatus,
  type EmployeeEmploymentTransition,
  type EmployeeProfile,
} from "@bduck/shared-types";
import type { z } from "zod";
import {
  applyScheduledEmployeeEmploymentTransition,
  createEmployeeEmploymentTransitionRecord,
} from "../repositories/employeeEmploymentTransitionRepository.js";
import { cancelScheduledEmployeeEmploymentTransition } from "../repositories/employeeEmploymentTransitionCancellationRepository.js";
import {
  findDueEmployeeEmploymentTransitions,
  findEmployeeEmploymentTransitions,
  getEmployeeEmploymentTransitionById,
} from "../repositories/employeeEmploymentTransitionQueryRepository.js";
import { getEmployeeProfileById } from "../repositories/employeeProfileRepository.js";
import type { AuditMetadata } from "./auditService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  createEmployeeEmploymentTransitionSchema,
  cancelEmployeeEmploymentTransitionSchema,
} from "./employeeEmploymentSchemas.js";
import {
  canTransitionEmploymentStatus,
  employmentDatePatchForTransition,
  getVietnamLocalDate,
  validateEmployeeEmploymentProfile,
} from "./employeeEmploymentPolicy.js";
import { releaseProbationLeaveForProfile } from "./leaveBalanceService.js";

type CreateTransitionInput = z.infer<
  typeof createEmployeeEmploymentTransitionSchema
>;
type CancelTransitionInput = z.infer<
  typeof cancelEmployeeEmploymentTransitionSchema
>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Hồ sơ nhân viên hoặc lệnh chuyển trạng thái không tồn tại.",
    zh: "员工档案或状态转换记录不存在。",
  },
};

const invalidTransitionError = {
  statusCode: 409,
  messages: {
    vi: "Không thể chuyển giữa hai trạng thái lao động đã chọn.",
    zh: "无法在所选劳动状态之间转换。",
  },
};

const assertProjectedProfileIsValid = (
  profile: EmployeeProfile,
  patch: Partial<EmployeeProfile>,
) => {
  const issue = validateEmployeeEmploymentProfile({
    ...profile,
    ...patch,
  })[0];
  if (!issue) return;
  throw {
    statusCode: 400,
    messages: issue.messages,
    field: issue.field,
  };
};

const writeAppliedAudits = async (
  result: {
    transitionBefore?: EmployeeEmploymentTransition;
    transition: EmployeeEmploymentTransition;
    previousProfile: EmployeeProfile;
    profile: EmployeeProfile;
  },
  actorId: string,
  auditMetadata?: AuditMetadata,
) => {
  await Promise.all([
    logAudit({
      entity_type: "employee_employment_transitions",
      entity_id: result.transition.id,
      warehouse_id: result.transition.workplace_warehouse_id,
      action: result.transitionBefore ? AuditAction.UPDATE : AuditAction.CREATE,
      user_id: actorId,
      old_value: result.transitionBefore
        ? (result.transitionBefore as unknown as Record<string, unknown>)
        : null,
      new_value: result.transition as unknown as Record<string, unknown>,
      ...auditMetadata,
    }),
    logAudit({
      entity_type: "employee_profiles",
      entity_id: result.profile.id,
      warehouse_id: result.profile.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: result.previousProfile as unknown as Record<string, unknown>,
      new_value: result.profile as unknown as Record<string, unknown>,
      ...auditMetadata,
    }),
  ]);
};

const releaseProbationLeaveSafely = async (
  profile: EmployeeProfile,
  effectiveDate: string,
  actorId: string,
) => {
  if (profile.employment_status !== EmployeeEmploymentStatus.OFFICIAL) return;
  try {
    await releaseProbationLeaveForProfile(profile, effectiveDate, actorId);
  } catch (error) {
    console.error(
      "[employeeEmploymentService] probation leave release deferred",
      profile.id,
      error,
    );
  }
};

export const fetchEmployeeEmploymentTransitions = async (
  employeeProfileId: string,
  authorization: AuthorizationService,
): Promise<EmployeeEmploymentTransition[]> => {
  const profile = await getEmployeeProfileById(employeeProfileId);
  if (!profile) throw notFoundError;
  authorization.assert("employees.read", profile.workplace_warehouse_id);
  return findEmployeeEmploymentTransitions(employeeProfileId);
};

export const createEmployeeEmploymentTransition = async (
  employeeProfileId: string,
  input: CreateTransitionInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<{
  transition: EmployeeEmploymentTransition;
  profile: EmployeeProfile;
}> => {
  const profile = await getEmployeeProfileById(employeeProfileId);
  if (!profile) throw notFoundError;
  authorization.assert(
    "employees.employment.manage",
    profile.workplace_warehouse_id,
  );
  const fromStatus =
    profile.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;
  if (!canTransitionEmploymentStatus(fromStatus, input.to_status)) {
    throw invalidTransitionError;
  }

  const patch = employmentDatePatchForTransition(
    input.to_status,
    input.effective_date,
    input.probation_end_date,
  );
  assertProjectedProfileIsValid(profile, patch);
  const isImmediate = input.effective_date <= getVietnamLocalDate();
  const result = await createEmployeeEmploymentTransitionRecord(
    {
      employee_profile_id: profile.id,
      employee_user_id: profile.user_id,
      workplace_warehouse_id: profile.workplace_warehouse_id,
      from_status: fromStatus,
      to_status: input.to_status,
      effective_date: input.effective_date,
      probation_end_date: input.probation_end_date ?? null,
      reason: input.reason,
      requested_by: actorId,
      action_time: auditMetadata?.action_time,
    },
    isImmediate ? patch : null,
  );

  if (isImmediate) {
    await releaseProbationLeaveSafely(
      result.profile,
      input.effective_date,
      actorId,
    );
    await writeAppliedAudits(result, actorId, auditMetadata);
  } else {
    await logAudit({
      entity_type: "employee_employment_transitions",
      entity_id: result.transition.id,
      warehouse_id: result.transition.workplace_warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: result.transition as unknown as Record<string, unknown>,
      ...auditMetadata,
    });
  }
  return { transition: result.transition, profile: result.profile };
};

export const cancelEmployeeEmploymentTransition = async (
  transitionId: string,
  input: CancelTransitionInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<EmployeeEmploymentTransition> => {
  const existing = await getEmployeeEmploymentTransitionById(transitionId);
  if (!existing) throw notFoundError;
  authorization.assert(
    "employees.employment.manage",
    existing.workplace_warehouse_id,
  );
  const result = await cancelScheduledEmployeeEmploymentTransition(
    transitionId,
    actorId,
    input.reason,
  );
  await logAudit({
    entity_type: "employee_employment_transitions",
    entity_id: transitionId,
    warehouse_id: result.transition.workplace_warehouse_id,
    action: AuditAction.CANCEL,
    user_id: actorId,
    old_value: result.previous as unknown as Record<string, unknown>,
    new_value: result.transition as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return result.transition;
};

export const applyDueEmployeeEmploymentTransitions = async (
  actorId: string,
  now = new Date(),
): Promise<{ applied: number; skipped: number; failed: number }> => {
  const dueTransitions = await findDueEmployeeEmploymentTransitions(
    getVietnamLocalDate(now),
  );
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  for (const transition of dueTransitions) {
    try {
      const profile = await getEmployeeProfileById(
        transition.employee_profile_id,
      );
      if (!profile) {
        failed += 1;
        continue;
      }
      const patch = employmentDatePatchForTransition(
        transition.to_status,
        transition.effective_date,
        transition.probation_end_date,
      );
      assertProjectedProfileIsValid(profile, patch);
      const result = await applyScheduledEmployeeEmploymentTransition(
        transition.id,
        patch,
        actorId,
      );
      if (!result) {
        skipped += 1;
        continue;
      }
      await releaseProbationLeaveSafely(
        result.profile,
        transition.effective_date,
        actorId,
      );
      await writeAppliedAudits(result, actorId);
      applied += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[employeeEmploymentService] failed to apply transition",
        transition.id,
        error,
      );
    }
  }
  return { applied, skipped, failed };
};
