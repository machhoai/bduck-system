import {
  LeaveRequestStatus,
  type AttendanceLeaveDay,
  type LeaveRequest,
} from "@bduck/shared-types";

const visibleAttendanceLeaveStatuses = new Set([
  LeaveRequestStatus.PENDING_APPROVAL,
  LeaveRequestStatus.APPROVED,
  LeaveRequestStatus.APPROVER_UNAVAILABLE,
]);

export const mapAttendanceLeaveDays = (
  requests: LeaveRequest[],
  dateFrom: string,
  dateTo: string,
): AttendanceLeaveDay[] =>
  requests.flatMap((request) =>
    visibleAttendanceLeaveStatuses.has(request.status) && !request.is_deleted
      ? request.days.flatMap((day) =>
          day.date >= dateFrom && day.date <= dateTo
            ? [
                {
                  leave_request_id: request.id,
                  employee_profile_id: request.employee_profile_id,
                  employee_user_id: request.employee_user_id,
                  warehouse_id: request.workplace_warehouse_id,
                  attendance_date: day.date,
                  request_type: request.request_type,
                  portion: day.portion,
                  status: request.status,
                },
              ]
            : [],
        )
      : [],
  );
