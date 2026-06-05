import { db } from "../config/firebase.js";
import type { Role, User, UserWarehouseRole } from "@bduck/shared-types";

const USERS_COLLECTION = "users";
const USER_ROLES_COLLECTION = "user_warehouse_roles";

export const getUserById = async (uid: string): Promise<User | null> => {
  const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) return null;
  const data = userSnap.data() as User;
  if (!data.id) data.id = uid;
  return data;
};

export const findUsers = async (): Promise<User[]> => {
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("is_deleted", "==", false)
    .get();

  return snapshot.docs.map((doc) => doc.data() as User);
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
    Pick<User, "username" | "email" | "full_name" | "employee_id" | "status" | "mfa_enabled" | "mfa_secret" | "email_otp" | "email_otp_expires_at">
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

export const getUserWarehouseRoles = async (
  userId: string,
): Promise<UserWarehouseRole[]> => {
  const snapshot = await db
    .collection(USER_ROLES_COLLECTION)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as UserWarehouseRole,
  );
};

export const replaceUserWarehouseRoles = async (
  userId: string,
  assignments: Omit<UserWarehouseRole, "created_at">[],
): Promise<UserWarehouseRole[]> => {
  const existing = await getUserWarehouseRoles(userId);
  const batch = db.batch();
  const now = new Date();

  existing.forEach((assignment) => {
    batch.update(db.collection(USER_ROLES_COLLECTION).doc(assignment.id), {
      is_active: false,
    });
  });

  const nextAssignments = assignments.map((assignment) => ({
    ...assignment,
    created_at: now,
  }));

  nextAssignments.forEach((assignment) => {
    batch.set(db.collection(USER_ROLES_COLLECTION).doc(assignment.id), assignment);
  });

  await batch.commit();
  return nextAssignments;
};

export const deactivateUserWarehouseRoles = async (
  userId: string,
): Promise<void> => {
  const existing = await getUserWarehouseRoles(userId);
  if (existing.length === 0) return;

  const batch = db.batch();
  existing.forEach((assignment) => {
    batch.update(db.collection(USER_ROLES_COLLECTION).doc(assignment.id), {
      is_active: false,
    });
  });
  await batch.commit();
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
