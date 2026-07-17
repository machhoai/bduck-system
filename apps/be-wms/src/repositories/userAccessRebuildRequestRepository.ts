import {
  USER_ACCESS_REBUILD_REQUESTS_COLLECTION,
  type UserAccessRebuildRequest,
} from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

const requestRef = (userId: string) =>
  db.collection(USER_ACCESS_REBUILD_REQUESTS_COLLECTION).doc(userId);

const mapRequest = (snapshot: FirebaseFirestore.DocumentSnapshot) =>
  mapFirestoreDocument<UserAccessRebuildRequest>(
    snapshot,
    ["requested_at", "created_at", "updated_at", "action_time", "sync_time"],
    ["completed_at"],
  );

export const enqueueUserAccessRebuilds = async (
  userIds: readonly string[],
  reason: string,
  requestedBy: string,
): Promise<void> => {
  const ids = Array.from(new Set(userIds.filter(Boolean))).sort();
  for (let index = 0; index < ids.length; index += 400) {
    const chunk = ids.slice(index, index + 400);
    const refs = chunk.map(requestRef);
    const snapshots = await db.getAll(...refs);
    const now = new Date();
    const batch = db.batch();
    refs.forEach((ref, refIndex) => {
      const snapshot = snapshots[refIndex];
      batch.set(
        ref,
        {
          id: ref.id,
          user_id: ref.id,
          status: "PENDING",
          reasons: FieldValue.arrayUnion(reason),
          revision: FieldValue.increment(1),
          requested_by: requestedBy,
          requested_at: now,
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
            ? (snapshot.get("created_at") ?? now)
            : now,
          updated_at: now,
          action_time: now,
          sync_time: now,
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
};

export const completeUserAccessRebuild = async (
  userId: string,
  accessVersion: number,
): Promise<void> => {
  const now = new Date();
  await requestRef(userId).set(
    {
      status: "COMPLETED",
      attempts: FieldValue.increment(1),
      completed_at: now,
      materialized_access_version: accessVersion,
      last_error: null,
      updated_at: now,
      sync_time: now,
    },
    { merge: true },
  );
};

export const failUserAccessRebuild = async (
  userId: string,
  error: string,
): Promise<void> => {
  const now = new Date();
  await requestRef(userId).set(
    {
      status: "FAILED",
      attempts: FieldValue.increment(1),
      completed_at: null,
      last_error: error.slice(0, 1000),
      updated_at: now,
      sync_time: now,
    },
    { merge: true },
  );
};

export const findPendingUserAccessRebuilds = async (
  limit = 100,
): Promise<UserAccessRebuildRequest[]> => {
  const snapshot = await db
    .collection(USER_ACCESS_REBUILD_REQUESTS_COLLECTION)
    .where("status", "in", ["PENDING", "FAILED"])
    .where("is_deleted", "==", false)
    .orderBy("requested_at", "asc")
    .limit(limit)
    .get();
  return snapshot.docs.map(mapRequest);
};
