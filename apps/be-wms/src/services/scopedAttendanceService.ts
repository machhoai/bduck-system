import type { AttendanceLeaveDay, CompanyHoliday, LeaveRequest } from "@bduck/shared-types";

import type { AuthenticatedRequestUser } from "../api/middlewares/requestAccessContext.js";
import { listActiveAttendancePolicies } from "../repositories/attendanceRepository.js";
import { getEmployeeProfileByUserId } from "../repositories/employeeProfileRepository.js";
import { findCompanyHolidays } from "../repositories/leaveHolidayRepository.js";
import {
  findLeaveRequestsByProfile,
  findLeaveRequestsScoped,
} from "../repositories/leaveRequestQueryRepository.js";

import {
  assertAnyAttendanceAction,
  assertPersonalAttendanceAction,
  buildAttendanceCapabilities,
} from "./attendanceAuthorizationPolicy.js";
import { mapAttendanceLeaveDays } from "./attendanceLeavePolicy.js";
import * as attendanceService from "./attendanceService.js";
import * as attendanceWorkArrangementService from "./attendanceWorkArrangementService.js";
import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";

export const fetchAttendanceContext = async (
  user: AuthenticatedRequestUser,
  requestIps: string | Array<string | null | undefined> | null | undefined,
  authorization: AuthorizationService,
) => {
  assertAnyAttendanceAction(authorization);
  const profile = await getEmployeeProfileByUserId(user.id);
  const attendanceFacilityId = profile?.workplace_warehouse_id ?? null;
  return attendanceService.fetchAttendanceContext(
    user,
    requestIps,
    buildAttendanceCapabilities(authorization, attendanceFacilityId),
    profile,
  );
};

export const checkInAttendance = async (
  user: AuthenticatedRequestUser,
  input: Parameters<typeof attendanceService.checkInAttendance>[1],
  requestIps: string | Array<string | null | undefined> | null | undefined,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  const profile = await getEmployeeProfileByUserId(user.id);
  assertPersonalAttendanceAction(
    authorization,
    "attendance.check_in",
    profile?.workplace_warehouse_id ?? null,
  );
  return attendanceService.checkInAttendance(
    user,
    input,
    requestIps,
    auditMetadata,
    profile,
  );
};

export const createLateArrivalReport = async (
  user: AuthenticatedRequestUser,
  input: Parameters<typeof attendanceService.createLateArrivalReport>[1],
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  const profile = await getEmployeeProfileByUserId(user.id);
  assertPersonalAttendanceAction(
    authorization,
    "attendance.check_in",
    profile?.workplace_warehouse_id ?? null,
  );
  return attendanceService.createLateArrivalReport(
    user,
    input,
    auditMetadata,
    profile,
  );
};

export const fetchAttendancePolicies = (authorization: AuthorizationService) =>
  listActiveAttendancePolicies(
    authorization.facilityIdsFor("attendance.config"),
  );

export const fetchAttendanceLeaveDays = async (
  user: AuthenticatedRequestUser,
  dateFrom: string,
  dateTo: string,
  authorization: AuthorizationService,
): Promise<AttendanceLeaveDay[]> => {
  const viewFacilityIds = authorization.facilityIdsFor("attendance.view");
  let requests: LeaveRequest[];
  if (authorization.context.isSystemAdmin || viewFacilityIds.length > 0) {
    requests = await findLeaveRequestsScoped({
      isSystemAdmin: authorization.context.isSystemAdmin,
      facilityIds: viewFacilityIds,
    });
  } else {
    const profile = await getEmployeeProfileByUserId(user.id);
    assertPersonalAttendanceAction(
      authorization,
      "attendance.check_in",
      profile?.workplace_warehouse_id ?? null,
    );
    requests = profile ? await findLeaveRequestsByProfile(profile.id) : [];
  }
  return mapAttendanceLeaveDays(requests, dateFrom, dateTo);
};

export const fetchAttendanceHolidays = (
  dateFrom: string,
  dateTo: string,
): Promise<CompanyHoliday[]> => findCompanyHolidays(dateFrom, dateTo);

export const updateAttendancePolicy = (
  user: AuthenticatedRequestUser,
  warehouseId: string,
  input: Parameters<typeof attendanceService.updateAttendancePolicy>[2],
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

export const fetchAttendanceWorkArrangements = (
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.config", warehouseId);
  return attendanceWorkArrangementService.fetchAttendanceWorkArrangements(
    warehouseId,
  );
};

export const approveAttendanceWorkArrangement = (
  user: AuthenticatedRequestUser,
  warehouseId: string,
  input: Parameters<
    typeof attendanceWorkArrangementService.approveAttendanceWorkArrangement
  >[2],
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.config", warehouseId);
  return attendanceWorkArrangementService.approveAttendanceWorkArrangement(
    user,
    warehouseId,
    input,
    auditMetadata,
  );
};

export const cancelAttendanceWorkArrangement = (
  user: AuthenticatedRequestUser,
  warehouseId: string,
  arrangementId: string,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  authorization.assert("attendance.config", warehouseId);
  return attendanceWorkArrangementService.cancelAttendanceWorkArrangement(
    user,
    warehouseId,
    arrangementId,
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
