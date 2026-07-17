import type { UserWarehouseRole } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const USER_ROLES_COLLECTION = "user_warehouse_roles";

const mapAssignment = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): UserWarehouseRole => ({
  ...(snapshot.data() as Omit<UserWarehouseRole, "id">),
  id: snapshot.id,
});

export const getUserWarehouseRoles = async (
  userId: string,
): Promise<UserWarehouseRole[]> => {
  const snapshot = await db
    .collection(USER_ROLES_COLLECTION)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map(mapAssignment);
};

export const getUserWarehouseRolesForUsers = async (
  userIds: readonly string[],
): Promise<UserWarehouseRole[]> => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const assignments: UserWarehouseRole[] = [];
  for (let index = 0; index < ids.length; index += 30) {
    const chunk = ids.slice(index, index + 30);
    const snapshot = await db
      .collection(USER_ROLES_COLLECTION)
      .where("user_id", "in", chunk)
      .get();
    assignments.push(...snapshot.docs.map(mapAssignment));
  }
  return assignments;
};

export const findActiveUserIdsByRoleId = async (
  roleId: string,
): Promise<string[]> => {
  const snapshot = await db
    .collection(USER_ROLES_COLLECTION)
    .where("role_id", "==", roleId)
    .get();
  return Array.from(
    new Set(
      snapshot.docs.flatMap((document) => {
        const assignment = mapAssignment(document);
        return assignment.is_active && assignment.is_deleted === false
          ? [assignment.user_id]
          : [];
      }),
    ),
  ).sort();
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
      updated_at: now,
    });
  });

  const nextAssignments = assignments.map((assignment) => ({
    ...assignment,
    scope_origin: "DIRECT" as const,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  }));

  nextAssignments.forEach((assignment) => {
    batch.set(
      db.collection(USER_ROLES_COLLECTION).doc(assignment.id),
      assignment,
    );
  });

  await batch.commit();
  return nextAssignments;
};

export const replaceManagedUserWarehouseRoles = async (
  userId: string,
  assignments: Omit<UserWarehouseRole, "created_at">[],
  scope: { isSystemAdmin: boolean; facilityIds: readonly string[] },
): Promise<UserWarehouseRole[]> => {
  if (scope.isSystemAdmin) {
    return replaceUserWarehouseRoles(userId, assignments);
  }

  const managedFacilityIds = new Set(scope.facilityIds);
  if (managedFacilityIds.size === 0) return [];
  const existing = await getUserWarehouseRoles(userId);
  const now = new Date();
  const batch = db.batch();
  existing.forEach((assignment) => {
    if (
      assignment.warehouse_id !== null &&
      managedFacilityIds.has(assignment.warehouse_id)
    ) {
      batch.update(db.collection(USER_ROLES_COLLECTION).doc(assignment.id), {
        is_active: false,
        updated_at: now,
      });
    }
  });

  const nextAssignments = assignments.map((assignment) => ({
    ...assignment,
    scope_origin: "DIRECT" as const,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  }));
  nextAssignments.forEach((assignment) => {
    batch.set(
      db.collection(USER_ROLES_COLLECTION).doc(assignment.id),
      assignment,
    );
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
  const now = new Date();
  existing.forEach((assignment) => {
    batch.update(db.collection(USER_ROLES_COLLECTION).doc(assignment.id), {
      is_active: false,
      updated_at: now,
    });
  });
  await batch.commit();
};
