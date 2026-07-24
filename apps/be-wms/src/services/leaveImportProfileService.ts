import type { LeaveImportEmployeeOption } from "@bduck/shared-types";
import { findEmployeeProfilesScoped } from "../repositories/employeeProfileRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanImportLeaveHistory,
  LEAVE_IMPORT_PERMISSION,
} from "./leaveImportAccessService.js";

export const fetchLeaveImportEmployeeOptions = async (
  authorization: AuthorizationService,
): Promise<LeaveImportEmployeeOption[]> => {
  assertCanImportLeaveHistory(authorization);
  const profiles = await findEmployeeProfilesScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor(LEAVE_IMPORT_PERMISSION),
  });
  return profiles
    .map((profile) => ({
      id: profile.id,
      employee_code: profile.employee_code,
      full_name: profile.full_name,
      workplace_warehouse_id: profile.workplace_warehouse_id,
    }))
    .sort(
      (left, right) =>
        left.full_name.localeCompare(right.full_name, "vi") ||
        left.employee_code.localeCompare(right.employee_code),
    );
};
