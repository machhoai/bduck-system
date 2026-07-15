import {
  EmployeeProfileStatus,
  UserStatus,
  type User,
} from "@bduck/shared-types";
import { findUserByField } from "../repositories/userRepository.js";
import {
  AuthorizationService,
  authorizationError,
} from "./authorization/index.js";

export const userConflictError = (field: string, value: string) => ({
  statusCode: 409,
  messages: {
    vi: `${field} "${value}" đã tồn tại.`,
    zh: `${field} "${value}" 已存在。`,
  },
});

export const assertUniqueUserFields = async (
  input: Partial<Pick<User, "email" | "employee_id">>,
  currentUserId?: string,
): Promise<void> => {
  for (const [field, value] of Object.entries(input)) {
    if (!value) continue;
    const existing = await findUserByField(
      field as "email" | "employee_id",
      value,
    );
    if (existing && existing.id !== currentUserId) {
      throw userConflictError(field, value);
    }
  }
};

export const assertWorkplaceWrite = (
  authorization: AuthorizationService,
  workplaceId: string | null,
): void => {
  if (workplaceId === null) {
    if (!authorization.context.isSystemAdmin) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
    return;
  }
  authorization.assert("users.write", workplaceId);
};

export const employeeProfileStatusForUser = (
  status: UserStatus,
): EmployeeProfileStatus =>
  status === UserStatus.ACTIVE
    ? EmployeeProfileStatus.ACTIVE
    : EmployeeProfileStatus.INACTIVE;
