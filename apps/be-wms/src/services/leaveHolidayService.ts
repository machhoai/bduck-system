import {
  AuditAction,
  type UpsertCompanyHolidayInput,
} from "@bduck/shared-types";
import {
  findCompanyHolidays,
  softDeleteCompanyHoliday,
  upsertCompanyHoliday,
} from "../repositories/leaveHolidayRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { authorizationError } from "./authorization/index.js";
import { logAudit } from "./auditService.js";

const assertCompanyPermission = (
  authorization: AuthorizationService,
  permission: string,
) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor(permission).length === 0
  ) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

export const fetchCompanyHolidays = async (
  year: number,
  authorization: AuthorizationService,
) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor("leave.self.read").length === 0 &&
    authorization.facilityIdsFor("leave.request.create").length === 0 &&
    authorization.facilityIdsFor("leave.holidays.manage").length === 0
  ) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
  return findCompanyHolidays(`${year}-01-01`, `${year}-12-31`);
};

export const createCompanyHoliday = async (
  input: UpsertCompanyHolidayInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  assertCompanyPermission(authorization, "leave.holidays.manage");
  const result = await upsertCompanyHoliday(input, actorId);
  await logAudit({
    entity_type: "company_holidays",
    entity_id: result.holiday.id,
    action: result.previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: result.previous as unknown as Record<string, unknown> | null,
    new_value: result.holiday as unknown as Record<string, unknown>,
    action_time: input.action_time,
  });
  return result.holiday;
};

export const removeCompanyHoliday = async (
  holidayId: string,
  actorId: string,
  actionTime: Date,
  authorization: AuthorizationService,
) => {
  assertCompanyPermission(authorization, "leave.holidays.manage");
  const result = await softDeleteCompanyHoliday(
    holidayId,
    actorId,
    actionTime,
  );
  await logAudit({
    entity_type: "company_holidays",
    entity_id: holidayId,
    action: AuditAction.SOFT_DELETE,
    user_id: actorId,
    old_value: result.previous as unknown as Record<string, unknown>,
    new_value: result.holiday as unknown as Record<string, unknown>,
    action_time: actionTime,
  });
  return result.holiday;
};
