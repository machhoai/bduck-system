import type {
  User,
  UserEffectiveAccessSnapshot,
  UserWarehouseRole,
} from "@bduck/shared-types";
import {
  findUserFacilityAccessGrants,
  getUserAccessMetadata,
} from "../repositories/userAccessReadRepository.js";
import {
  findUsersScoped,
  getUserById,
  getUserWarehouseRoles,
  getUserWarehouseRolesForUsers,
} from "../repositories/userRepository.js";
import { AuthorizationService } from "./authorization/index.js";
import { visibleAssignments } from "./userAssignmentService.js";
import {
  assertCanAccessTargetUser,
  canAccessTargetUser,
} from "./userTargetPolicy.js";

export type SensitiveUserField =
  | "password_hash"
  | "mfa_secret"
  | "email_otp"
  | "email_otp_expires_at";

export interface UserWithAssignments extends Omit<User, SensitiveUserField> {
  assignments: UserWarehouseRole[];
}

export const userNotFoundError = {
  statusCode: 404,
  messages: {
    vi: "Người dùng không tồn tại hoặc đã bị xóa.",
    zh: "用户不存在或已被删除。",
  },
};

export const sanitizeUserRecord = (
  user: User,
): Omit<User, SensitiveUserField> => {
  const {
    password_hash: _passwordHash,
    mfa_secret: _mfaSecret,
    email_otp: _emailOtp,
    email_otp_expires_at: _emailOtpExpiresAt,
    ...safeUser
  } = user;
  return safeUser;
};

export const loadUserRecord = async (userId: string): Promise<User> => {
  const user = await getUserById(userId);
  if (!user || user.is_deleted) throw userNotFoundError;
  return user;
};

export const createUserView = (
  user: User,
  assignments: readonly UserWarehouseRole[],
  authorization: AuthorizationService,
): UserWithAssignments => ({
  ...sanitizeUserRecord(user),
  assignments: visibleAssignments(assignments, authorization),
});

export const fetchUsers = async (
  authorization: AuthorizationService,
): Promise<UserWithAssignments[]> => {
  const users = await findUsersScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("users.read"),
  });
  const assignments = await getUserWarehouseRolesForUsers(
    users.map((user) => user.id),
  );
  const byUser = new Map<string, UserWarehouseRole[]>();
  assignments.forEach((assignment) => {
    const values = byUser.get(assignment.user_id) ?? [];
    values.push(assignment);
    byUser.set(assignment.user_id, values);
  });

  return users.flatMap((user) => {
    const userAssignments = byUser.get(user.id) ?? [];
    return canAccessTargetUser(
      authorization,
      "users.read",
      user,
      userAssignments,
    )
      ? [createUserView(user, userAssignments, authorization)]
      : [];
  });
};

export const fetchUserById = async (
  userId: string,
  authorization: AuthorizationService,
): Promise<UserWithAssignments> => {
  const user = await loadUserRecord(userId);
  const assignments = await getUserWarehouseRoles(userId);
  assertCanAccessTargetUser(authorization, "users.read", user, assignments);
  return createUserView(user, assignments, authorization);
};

export const fetchUserEffectiveAccess = async (
  userId: string,
  authorization: AuthorizationService,
): Promise<UserEffectiveAccessSnapshot> => {
  const user = await loadUserRecord(userId);
  const assignments = await getUserWarehouseRoles(userId);
  assertCanAccessTargetUser(
    authorization,
    "users.read",
    user,
    assignments,
  );
  const metadata = await getUserAccessMetadata(userId);
  if (!metadata?.active_version_id) return { metadata, grants: [] };
  const grants = await findUserFacilityAccessGrants(
    userId,
    metadata.active_version_id,
  );
  const visibleGrants = authorization.context.isSystemAdmin
    ? grants
    : grants.filter((grant) =>
        authorization.hasFacilityAccess(grant.facility_id),
      );
  return { metadata, grants: visibleGrants };
};
