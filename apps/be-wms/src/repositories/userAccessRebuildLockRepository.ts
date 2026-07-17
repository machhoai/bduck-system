import { randomUUID } from "node:crypto";
import { USER_ACCESS_REBUILD_LOCKS_COLLECTION } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const LEASE_DURATION_MS = 5 * 60 * 1000;

interface RebuildLock {
  user_id: string;
  lease_owner: string;
  lease_expires_at: Date;
  is_active: boolean;
  created_at: Date;
}

const lockRef = (userId: string) =>
  db.collection(USER_ACCESS_REBUILD_LOCKS_COLLECTION).doc(userId);

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

export const acquireUserAccessRebuildLease = async (
  userId: string,
  actorId: string,
): Promise<string> => {
  const owner = randomUUID();
  await db.runTransaction(async (transaction) => {
    const ref = lockRef(userId);
    const snapshot = await transaction.get(ref);
    const existing = snapshot.data() as Partial<RebuildLock> | undefined;
    const expiresAt = toDate(existing?.lease_expires_at);
    const now = new Date();
    if (
      existing?.is_active === true &&
      expiresAt &&
      expiresAt.getTime() > now.getTime()
    ) {
      throw new Error("USER_ACCESS_REBUILD_IN_PROGRESS");
    }
    transaction.set(
      ref,
      {
        user_id: userId,
        lease_owner: owner,
        lease_expires_at: new Date(now.getTime() + LEASE_DURATION_MS),
        is_active: true,
        requested_by: actorId,
        is_deleted: false,
        created_at: snapshot.exists ? (existing?.created_at ?? now) : now,
        updated_at: now,
        action_time: now,
        sync_time: now,
      },
      { merge: true },
    );
  });
  return owner;
};

export const releaseUserAccessRebuildLease = async (
  userId: string,
  owner: string,
  error: string | null,
): Promise<void> => {
  await db.runTransaction(async (transaction) => {
    const ref = lockRef(userId);
    const snapshot = await transaction.get(ref);
    const existing = snapshot.data() as Partial<RebuildLock> | undefined;
    if (
      !snapshot.exists ||
      existing?.lease_owner !== owner ||
      existing.is_active !== true
    ) {
      throw new Error("USER_ACCESS_REBUILD_LEASE_LOST");
    }
    const now = new Date();
    transaction.update(ref, {
      is_active: false,
      lease_expires_at: now,
      last_error: error,
      updated_at: now,
      sync_time: now,
    });
  });
};
