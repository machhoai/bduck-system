import {
  EmployeeEmploymentTransitionStatus,
  type EmployeeEmploymentTransition,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const TRANSITIONS_COLLECTION = "employee_employment_transitions";

const withId = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeEmploymentTransition => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<EmployeeEmploymentTransition, "id">),
});

export const getEmployeeEmploymentTransitionById = async (
  transitionId: string,
): Promise<EmployeeEmploymentTransition | null> => {
  const snapshot = await db
    .collection(TRANSITIONS_COLLECTION)
    .doc(transitionId)
    .get();
  if (!snapshot.exists) return null;
  const transition = withId(snapshot);
  return transition.is_deleted ? null : transition;
};

export const findEmployeeEmploymentTransitions = async (
  employeeProfileId: string,
): Promise<EmployeeEmploymentTransition[]> => {
  const snapshot = await db
    .collection(TRANSITIONS_COLLECTION)
    .where("employee_profile_id", "==", employeeProfileId)
    .where("is_deleted", "==", false)
    .orderBy("effective_date", "desc")
    .get();
  return snapshot.docs.map(withId);
};

export const findDueEmployeeEmploymentTransitions = async (
  effectiveDate: string,
  limit = 200,
): Promise<EmployeeEmploymentTransition[]> => {
  const snapshot = await db
    .collection(TRANSITIONS_COLLECTION)
    .where("status", "==", EmployeeEmploymentTransitionStatus.SCHEDULED)
    .where("is_deleted", "==", false)
    .where("effective_date", "<=", effectiveDate)
    .orderBy("effective_date", "asc")
    .limit(limit)
    .get();
  return snapshot.docs.map(withId);
};
