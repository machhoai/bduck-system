import { UserStatus, type User } from "@bduck/shared-types";

export const isUsableLoginUser = (user: User | null): user is User =>
  user !== null &&
  user.is_deleted === false &&
  user.status === UserStatus.ACTIVE;

export const assertUsableLoginUser = (user: User | null): User => {
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!isUsableLoginUser(user)) throw new Error("USER_ACCOUNT_NOT_ACTIVE");
  return user;
};
