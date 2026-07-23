import type { EmployeeProfile } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

const EMPLOYEE_PROFILES_COLLECTION = "employee_profiles";

const withId = (doc: FirebaseFirestore.DocumentSnapshot): EmployeeProfile => ({
  id: doc.id,
  ...(doc.data() as Omit<EmployeeProfile, "id">),
});

export const findEmployeeProfiles = async (): Promise<EmployeeProfile[]> => {
  const snapshot = await db
    .collection(EMPLOYEE_PROFILES_COLLECTION)
    .where("is_deleted", "==", false)
    .get();

  return snapshot.docs.map(withId);
};

export const findEmployeeProfilesScoped = async (scope: {
  isSystemAdmin: boolean;
  facilityIds: readonly string[];
}): Promise<EmployeeProfile[]> => {
  const queryAll = findEmployeeProfiles;
  const queryChunk = async (facilityIds: readonly string[]) => {
    const snapshot = await db
      .collection(EMPLOYEE_PROFILES_COLLECTION)
      .where("is_deleted", "==", false)
      .where("workplace_warehouse_id", "in", facilityIds)
      .get();
    return snapshot.docs.map(withId);
  };
  const groups = await executeFacilityScopedQuery({
    ...scope,
    queryAll,
    queryChunk,
  });
  return groups.flat();
};

export const findEmployeeProfilesByPhone = async (
  phone: string,
): Promise<EmployeeProfile[]> => {
  const normalizedPhone = phone.replace(/[\s().-]/g, "");
  if (!normalizedPhone) return [];

  const profiles = await findEmployeeProfiles();
  return profiles.filter(
    (profile) => profile.phone?.replace(/[\s().-]/g, "") === normalizedPhone,
  );
};

export const getEmployeeProfileById = async (
  profileId: string,
): Promise<EmployeeProfile | null> => {
  const snapshot = await db
    .collection(EMPLOYEE_PROFILES_COLLECTION)
    .doc(profileId)
    .get();

  if (!snapshot.exists) return null;
  const profile = withId(snapshot);
  return profile.is_deleted ? null : profile;
};

export const getEmployeeProfileByUserId = async (
  userId: string,
): Promise<EmployeeProfile | null> => {
  const snapshot = await db
    .collection(EMPLOYEE_PROFILES_COLLECTION)
    .where("user_id", "==", userId)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return withId(snapshot.docs[0]);
};

export const findEmployeeProfileByCode = async (
  employeeCode: string,
): Promise<EmployeeProfile | null> => {
  const snapshot = await db
    .collection(EMPLOYEE_PROFILES_COLLECTION)
    .where("employee_code", "==", employeeCode)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return withId(snapshot.docs[0]);
};

export const createEmployeeProfileRecord = async (
  profileId: string,
  input: Omit<
    EmployeeProfile,
    "id" | "created_at" | "updated_at" | "is_deleted"
  >,
): Promise<EmployeeProfile> => {
  const now = new Date();
  const profile: EmployeeProfile = {
    ...input,
    id: profileId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.collection(EMPLOYEE_PROFILES_COLLECTION).doc(profileId).set(profile);
  return profile;
};

export const createEmployeeProfileAndSyncUser = async (
  profileId: string,
  input: Parameters<typeof createEmployeeProfileRecord>[1],
): Promise<EmployeeProfile> => {
  const now = new Date();
  const profile: EmployeeProfile = {
    ...input,
    id: profileId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  const batch = db.batch();
  batch.set(
    db.collection(EMPLOYEE_PROFILES_COLLECTION).doc(profileId),
    profile,
  );
  if (profile.user_id) {
    batch.update(db.collection("users").doc(profile.user_id), {
      workplace_facility_id: profile.workplace_warehouse_id,
      updated_at: now,
    });
  }
  await batch.commit();
  return profile;
};

export const updateEmployeeProfileRecord = async (
  profileId: string,
  data: Partial<
    Pick<
      EmployeeProfile,
      | "user_id"
      | "employee_code"
      | "full_name"
      | "email"
      | "phone"
      | "job_title"
      | "department"
      | "workplace_warehouse_id"
      | "status"
      | "employment_status"
      | "probation_start_date"
      | "probation_end_date"
      | "official_start_date"
      | "resignation_date"
      | "notes"
    >
  >,
): Promise<void> => {
  await db
    .collection(EMPLOYEE_PROFILES_COLLECTION)
    .doc(profileId)
    .update({
      ...data,
      updated_at: new Date(),
    });
};

export const updateEmployeeProfileAndUserWorkplace = async (
  profileId: string,
  userId: string | null,
  data: Parameters<typeof updateEmployeeProfileRecord>[1],
): Promise<void> => {
  const now = new Date();
  const batch = db.batch();
  batch.update(db.collection(EMPLOYEE_PROFILES_COLLECTION).doc(profileId), {
    ...data,
    updated_at: now,
  });
  if (userId && typeof data.workplace_warehouse_id === "string") {
    batch.update(db.collection("users").doc(userId), {
      workplace_facility_id: data.workplace_warehouse_id,
      updated_at: now,
    });
  }
  await batch.commit();
};

export const softDeleteEmployeeProfileRecord = async (
  profileId: string,
): Promise<void> => {
  await db.collection(EMPLOYEE_PROFILES_COLLECTION).doc(profileId).update({
    is_deleted: true,
    updated_at: new Date(),
  });
};
