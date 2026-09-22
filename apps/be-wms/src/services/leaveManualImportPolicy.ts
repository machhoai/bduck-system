import {
  LeaveDayPortion,
  LeaveImportRecordType,
  LeaveRequestStatus,
  type EmployeeProfile,
  type PreviewManualLeaveHistoryInput,
} from "@bduck/shared-types";

import type { ParsedLeaveImportRow } from "./leaveImportWorkbookService.js";

export const buildManualLeaveImportRows = (
  input: PreviewManualLeaveHistoryInput,
  profile: Pick<EmployeeProfile, "employee_code">,
): ParsedLeaveImportRow[] =>
  input.days.map((day, index) => ({
    row_number: index + 1,
    record_type: LeaveImportRecordType.HISTORICAL_REQUEST,
    source_reference: `${input.client_reference}:${day.date}:${day.portion}`,
    employee_code: profile.employee_code.toUpperCase(),
    normalized_payload: {
      posting_date: day.date,
      leave_year: Number(day.date.slice(0, 4)),
      units: day.portion === LeaveDayPortion.FULL_DAY ? 1 : 0.5,
      request_type: input.request_type,
      request_status: LeaveRequestStatus.APPROVED,
      day_portion: day.portion,
      reason: input.reason.trim(),
    },
  }));
