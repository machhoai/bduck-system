import { USER_ACCESS_REBUILD_REQUESTS_COLLECTION } from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";

export const enqueueUserAccessRebuildsInTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  userIds: readonly string[],
  reason: string,
  requestedBy: string,
  actionTime: Date,
  syncTime: Date,
): Promise<void> => {
  const ids = Array.from(new Set(userIds.filter(Boolean))).sort();
  const refs = ids.map((userId) =>
    db.collection(USER_ACCESS_REBUILD_REQUESTS_COLLECTION).doc(userId),
  );
  const snapshots = refs.length > 0 ? await transaction.getAll(...refs) : [];
  refs.forEach((ref, index) => {
    const snapshot = snapshots[index];
    transaction.set(
      ref,
      {
        id: ref.id,
        user_id: ref.id,
        status: "PENDING",
        reasons: FieldValue.arrayUnion(reason),
        revision: FieldValue.increment(1),
        requested_by: requestedBy,
        requested_at: syncTime,
        completed_at: null,
        last_error: null,
        ...(snapshot?.exists
          ? {}
          : {
              attempts: 0,
              materialized_access_version: null,
            }),
        is_deleted: false,
        created_at: snapshot?.exists
          ? (snapshot.get("created_at") ?? syncTime)
          : syncTime,
        updated_at: syncTime,
        action_time: actionTime,
        sync_time: syncTime,
      },
      { merge: true },
    );
  });
};
