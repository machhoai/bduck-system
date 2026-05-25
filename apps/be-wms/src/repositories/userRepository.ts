import { db } from "../config/firebase.js";
import type { User, Role, UserWarehouseRole } from "@bduck/shared-types";

/**
 * Get user by UID
 */
export const getUserById = async (uid: string): Promise<User | null> => {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return null;
  }
  return userSnap.data() as User;
};

/**
 * Get all UserWarehouseRoles for a user
 */
export const getUserWarehouseRoles = async (
  userId: string,
): Promise<UserWarehouseRole[]> => {
  const snapshot = await db
    .collection("user_warehouse_roles")
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map(
    (doc: any) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as UserWarehouseRole,
  );
};

/**
 * Get a specific Role by ID
 */
export const getRoleById = async (roleId: string): Promise<Role | null> => {
  const roleSnap = await db.collection("roles").doc(roleId).get();
  if (!roleSnap.exists) {
    return null;
  }
  return {
    id: roleSnap.id,
    ...roleSnap.data(),
  } as Role;
};
