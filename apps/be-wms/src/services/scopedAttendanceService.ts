import type { AuthenticatedRequestUser } from "../api/middlewares/requestAccessContext.js";
import { listActiveAttendancePolicies } from "../repositories/attendanceRepository.js";
import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import * as attendanceService from "./attendanceService.js";

const workplaceId = (authorization: AuthorizationService): string => {
  const facilityId = authorization.context.workplaceFacilityId;
  if (!facilityId) authorization.assertFacilityAccess("");
  return facilityId as string;
};

const assertAnyAttendanceAction = (
  authorization: AuthorizationService,
  facilityId: string,
): void => {
  const actions = [
    "attendance.check_in",
    "attendance.view",
    "attendance.export",
    "attendance.config",
  ];
  if (!actions.some((action) => authorization.can(action, facilityId))) {
    authorization.assert(actions[0], facilityId);
  }
};

export const fetchAttendanceContext = (
  user: AuthenticatedRequestUser,
  requestIps: string | Array<string | null | undefined> | null | undefined,
  authorization: AuthorizationService,
) => {
  const facilityId = workplaceId(authorization);
  assertAnyAttendanceAction(authorization, facilityId);
  return attendanceService.fetchAttendanceContext(user, requestIps, {
    canCheckIn: authorization.can("attendance.check_in", facilityId),
    canView: authorization.can("attendance.view", facilityId),
    canConfigure: authorization.can("attendance.config", facilityId),
    canExport: authorization.can("attendance.export", facilityId),
  });
};

export const checkInAttendance = (
  user: AuthenticatedRequestUser,
  input: { action_time?: string },
  requestIps: string | Array<string | null | undefined> | null | undefined,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.check_in", workplaceId(authorization));
  return attendanceService.checkInAttendance(
    user,
    input,
    requestIps,
    auditMetadata,
  );
};

export const createLateArrivalReport = (
  user: AuthenticatedRequestUser,
  input: Parameters<typeof attendanceService.createLateArrivalReport>[1],
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.check_in", workplaceId(authorization));
  return attendanceService.createLateArrivalReport(user, input, auditMetadata);
};

export const fetchAttendancePolicies = (authorization: AuthorizationService) =>
  listActiveAttendancePolicies(
    authorization.facilityIdsFor("attendance.config"),
  );

export const updateAttendancePolicy = (
  user: AuthenticatedRequestUser,
  warehouseId: string,
  input: { enabled: boolean; ip_addresses: string[] },
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.config", warehouseId);
  return attendanceService.updateAttendancePolicy(
    user,
    warehouseId,
    input,
    auditMetadata,
  );
};

export const fetchAttendanceExemptions = (
  user: AuthenticatedRequestUser,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.config", warehouseId);
  return attendanceService.fetchAttendanceExemptions(user, warehouseId);
};

export const updateAttendanceExemptions = (
  user: AuthenticatedRequestUser,
  warehouseId: string,
  excludedUserIds: string[],
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.config", warehouseId);
  return attendanceService.updateAttendanceExemptions(
    user,
    warehouseId,
    excludedUserIds,
    auditMetadata,
  );
};
