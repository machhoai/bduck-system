import type { EmployeeProfile } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

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

export const softDeleteEmployeeProfileRecord = async (
  profileId: string,
): Promise<void> => {
  await db.collection(EMPLOYEE_PROFILES_COLLECTION).doc(profileId).update({
    is_deleted: true,
    updated_at: new Date(),
  });
};
