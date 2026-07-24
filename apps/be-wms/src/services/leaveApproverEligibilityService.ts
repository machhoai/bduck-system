import {
  buildAccessContext,
  AuthorizationService,
} from "./authorization/index.js";
import { loadAuthorizationSourceSnapshot } from "../repositories/authorizationSourceRepository.js";
import { findActiveUserIdsByRoleId } from "../repositories/userRepository.js";
import { getRoleById } from "../repositories/userRepository.js";
import type { LeaveApprovalAssignment } from "@bduck/shared-types";
import { isLeaveApprovalActorEligible } from "./leaveApprovalPolicy.js";

const authorizationFor = async (
  userId: string,
): Promise<AuthorizationService | null> => {
  try {
    const snapshot = await loadAuthorizationSourceSnapshot(userId);
    return new AuthorizationService(buildAccessContext(snapshot));
  } catch {
    return null;
  }
};

export const isEligibleLeaveApprover = async (
  userId: string,
  assignment: LeaveApprovalAssignment,
  facilityId: string,
  employeeUserId: string,
): Promise<boolean> => {
  const authorization = await authorizationFor(userId);
  return isLeaveApprovalActorEligible({
    actor_id: userId,
    employee_user_id: employeeUserId,
    assignment,
    has_permission:
      authorization?.can("leave.approve", facilityId) === true,
    has_assigned_role:
      assignment.mode === "ROLE" &&
      authorization?.hasRoleAtFacility(
        assignment.role_id,
        facilityId,
      ) === true,
  });
};

export const hasAvailableLeaveApprover = async (
  assignment: LeaveApprovalAssignment,
  facilityId: string,
  employeeUserId: string,
): Promise<boolean> => {
  if (assignment.mode === "ROLE") {
    const role = await getRoleById(assignment.role_id);
    if (
      !role ||
      (role.permissions["*"] !== true &&
        role.permissions["leave.approve"] !== true)
    ) {
      return false;
    }
  }
  const candidates =
    assignment.mode === "USER"
      ? [assignment.assigned_user_id]
      : await findActiveUserIdsByRoleId(assignment.role_id);
  for (const userId of candidates) {
    if (
      await isEligibleLeaveApprover(
        userId,
        assignment,
        facilityId,
        employeeUserId,
      )
    ) {
      return true;
    }
  }
  return false;
};

export const userHasAnyLeaveApprovalScope = async (
  userId: string,
): Promise<boolean> => {
  const authorization = await authorizationFor(userId);
  return Boolean(
    authorization &&
      authorization.facilityIdsFor("leave.approve").length > 0,
  );
};
