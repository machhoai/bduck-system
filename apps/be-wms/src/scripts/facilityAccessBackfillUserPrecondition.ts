import { db } from "../config/firebase.js";
import type { DocumentData } from "./facilityAccessBackfillPlanner.js";
import { assertUserWorkplaceSourceSnapshot } from "./facilityAccessBackfillUserSource.js";

export const assertCurrentUserWorkplaceSource = async (
  transaction: FirebaseFirestore.Transaction,
  currentUser: DocumentData,
  userId: string,
  expectedWorkplaceId: string,
): Promise<void> => {
  const profilesQuery = db
    .collection("employee_profiles")
    .where("user_id", "==", userId);
  const workplaceRef = db.collection("warehouses").doc(expectedWorkplaceId);
  const [profilesSnapshot, workplaceSnapshot] = await Promise.all([
    transaction.get(profilesQuery),
    transaction.get(workplaceRef),
  ]);

  assertUserWorkplaceSourceSnapshot({
    currentUser,
    profiles: profilesSnapshot.docs.map((profile) => ({
      id: profile.id,
      data: profile.data(),
    })),
    workplaceFacility: workplaceSnapshot.exists
      ? { id: workplaceSnapshot.id, data: workplaceSnapshot.data() ?? {} }
      : null,
    expectedWorkplaceId,
  });
};
