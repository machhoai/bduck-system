import { db } from "../config/firebase.js";
import type { Role, User } from "@bduck/shared-types";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

const USERS_COLLECTION = "users";

const mapUser = (snapshot: FirebaseFirestore.DocumentSnapshot): User => ({
  ...(snapshot.data() as Omit<User, "id">),
  id: snapshot.id,
});

export {
  deactivateUserWarehouseRoles,
  getUserWarehouseRoles,
  getUserWarehouseRolesForUsers,
  replaceManagedUserWarehouseRoles,
  replaceUserWarehouseRoles,
} from "./userRoleAssignmentRepository.js";

export class UsernameAlreadyExistsError extends Error {
  constructor(public readonly username: string) {
    super(`Username "${username}" already exists.`);
    this.name = "UsernameAlreadyExistsError";
  }
}

export const normalizeUsername = (username: string): string =>
  username.trim().toLowerCase();

export const getUserById = async (uid: string): Promise<User | null> => {
  const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) return null;
  return mapUser(userSnap);
};

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  if (userIds.length === 0) return [];

  const users: User[] = [];
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  for (const userId of uniqueIds) {
    const user = await getUserById(userId);
    if (user && !user.is_deleted && user.status !== "INACTIVE") {
      users.push(user);
    }
  }

  return users;
};

export const findUsers = async (): Promise<User[]> => {
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("is_deleted", "==", false)
    .get();

  return snapshot.docs.map(mapUser);
};

export const findUsersScoped = async (scope: {
  isSystemAdmin: boolean;
  facilityIds: readonly string[];
}): Promise<User[]> => {
  const queryAll = async () => {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("is_deleted", "==", false)
      .get();
    return snapshot.docs.map(mapUser);
  };
  const queryChunk = async (facilityIds: readonly string[]) => {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("is_deleted", "==", false)
      .where("workplace_facility_id", "in", facilityIds)
      .get();
    return snapshot.docs.map(mapUser);
  };
  const groups = await executeFacilityScopedQuery({
    ...scope,
    queryAll,
    queryChunk,
  });
  return groups.flat();
};

export const findUserByField = async (
  field: "username" | "email" | "employee_id",
  value: string,
): Promise<User | null> => {
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where(field, "==", value)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as User;
};

export const findUserByUsername = async (
  username: string,
): Promise<User | null> => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const users = await findUsers();
  return (
    users.find(
      (user) => normalizeUsername(user.username || "") === normalized,
    ) ?? null
  );
};

export const setUniqueUsername = async (
  userId: string,
  username: string,
): Promise<void> => {
  const nextUsername = username.trim();
  const normalized = normalizeUsername(nextUsername);
  const userRef = db.collection(USERS_COLLECTION).doc(userId);
  const activeUsersQuery = db
    .collection(USERS_COLLECTION)
    .where("is_deleted", "==", false);

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, usersSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(activeUsersQuery),
    ]);

    if (!userSnapshot.exists) {
      throw new Error("USER_NOT_FOUND");
    }

    const conflict = usersSnapshot.docs.some((doc) => {
      if (doc.id === userId) return false;
      const user = doc.data() as User;
      return normalizeUsername(user.username || "") === normalized;
    });

    if (conflict) {
      throw new UsernameAlreadyExistsError(nextUsername);
    }

    transaction.update(userRef, {
      username: nextUsername,
      updated_at: new Date(),
    });
  });
};

export const createUserRecord = async (
  userId: string,
  data: Omit<User, "created_at" | "updated_at" | "is_deleted">,
): Promise<User> => {
  const now = new Date();
  const user: User = {
    ...data,
    id: userId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.collection(USERS_COLLECTION).doc(userId).set(user);
  return user;
};

export const updateUserRecord = async (
  userId: string,
  data: Partial<
    Pick<
      User,
      | "username"
      | "email"
      | "full_name"
      | "employee_id"
      | "status"
      | "workplace_facility_id"
      | "mfa_enabled"
      | "mfa_secret"
      | "email_otp"
      | "email_otp_expires_at"
    >
  >,
): Promise<void> => {
  await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .update({ ...data, updated_at: new Date() });
};

export const softDeleteUserRecord = async (userId: string): Promise<void> => {
  await db.collection(USERS_COLLECTION).doc(userId).update({
    is_deleted: true,
    status: "INACTIVE",
    updated_at: new Date(),
  });
};

export const getRoleById = async (roleId: string): Promise<Role | null> => {
  const roleSnap = await db.collection("roles").doc(roleId).get();
  if (!roleSnap.exists) return null;

  const role = {
    id: roleSnap.id,
    ...roleSnap.data(),
  } as Role;

  return role.is_deleted ? null : role;
};
