import type { AuthorizationService } from "./authorization/index.js";

export const ATTENDANCE_ACTIONS = [
  "attendance.check_in",
  "attendance.view",
  "attendance.export",
  "attendance.config",
] as const;

export type AttendanceAction = (typeof ATTENDANCE_ACTIONS)[number];

const hasAnyFacilityPermission = (
  authorization: AuthorizationService,
  action: AttendanceAction,
): boolean =>
  authorization.context.isSystemAdmin ||
  authorization.facilityIdsFor(action).length > 0;

export const buildAttendanceCapabilities = (
  authorization: AuthorizationService,
  attendanceFacilityId: string | null,
) => {
  const canAtAttendanceFacility = (action: AttendanceAction) =>
    Boolean(
      attendanceFacilityId && authorization.can(action, attendanceFacilityId),
    );

  return {
    canCheckIn: canAtAttendanceFacility("attendance.check_in"),
    canView: hasAnyFacilityPermission(authorization, "attendance.view"),
    canConfigure: hasAnyFacilityPermission(authorization, "attendance.config"),
    canExport: hasAnyFacilityPermission(authorization, "attendance.export"),
    canAccessWorkplace: ATTENDANCE_ACTIONS.some(canAtAttendanceFacility),
  };
};

export const assertAnyAttendanceAction = (
  authorization: AuthorizationService,
): void => {
  if (
    !ATTENDANCE_ACTIONS.some((action) =>
      hasAnyFacilityPermission(authorization, action),
    )
  ) {
    authorization.assert(ATTENDANCE_ACTIONS[0], "");
  }
};

export const assertPersonalAttendanceAction = (
  authorization: AuthorizationService,
  action: "attendance.check_in",
  attendanceFacilityId: string | null,
): void => {
  if (!hasAnyFacilityPermission(authorization, action)) {
    authorization.assert(action, "");
  }
  if (attendanceFacilityId) {
    authorization.assert(action, attendanceFacilityId);
  }
};
