import { createHash } from "crypto";

import { db } from "../config/firebase.js";

const LOCKS = "partner_inventory_sync_locks";

const lockId = (connectionId: string, partnerStockId: string) =>
  createHash("sha256")
    .update(`${connectionId}\n${partnerStockId}`)
    .digest("hex");

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }
  if (value && typeof value === "object" && "seconds" in value) {
    return new Date(Number(value.seconds) * 1000);
  }
  return new Date(String(value));
};

export const acquirePartnerInventoryLock = async (input: {
  connectionId: string;
  partnerStockId: string;
  requestId: string;
  lockToken: string;
  actorId: string;
  leaseMs?: number;
}): Promise<void> => {
  const id = lockId(input.connectionId, input.partnerStockId);
  const reference = db.collection(LOCKS).doc(id);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.leaseMs ?? 3_600_000));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() as
      | {
          lock_token?: string;
          expires_at?: unknown;
          released_at?: unknown;
          needs_attention?: boolean;
        }
      | undefined;
    const currentExpiry = current?.expires_at
      ? toDate(current.expires_at).getTime()
      : 0;
    if (snapshot.exists && !current?.released_at && current?.needs_attention) {
      throw new Error("PARTNER_SYNC_NEEDS_ATTENTION");
    }
    if (
      snapshot.exists &&
      !current?.released_at &&
      current?.lock_token !== input.lockToken &&
      currentExpiry > now.getTime()
    ) {
      throw new Error("PARTNER_SYNC_IN_PROGRESS");
    }
    transaction.set(reference, {
      id,
      connection_id: input.connectionId,
      partner_stock_id: input.partnerStockId,
      request_id: input.requestId,
      lock_token: input.lockToken,
      acquired_by: input.actorId,
      acquired_at: now,
      expires_at: expiresAt,
      released_at: null,
      needs_attention: false,
    });
  });
};

export const markPartnerInventoryLockNeedsAttention = async (input: {
  connectionId: string;
  partnerStockId: string;
  lockToken: string;
}): Promise<void> => {
  const reference = db
    .collection(LOCKS)
    .doc(lockId(input.connectionId, input.partnerStockId));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || snapshot.data()?.lock_token !== input.lockToken) {
      throw new Error("PARTNER_SYNC_LOCK_LOST");
    }
    transaction.update(reference, {
      needs_attention: true,
      needs_attention_at: new Date(),
      updated_at: new Date(),
    });
  });
};

export const releasePartnerInventoryLock = async (input: {
  connectionId: string;
  partnerStockId: string;
  lockToken: string;
}): Promise<void> => {
  const reference = db
    .collection(LOCKS)
    .doc(lockId(input.connectionId, input.partnerStockId));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || snapshot.data()?.lock_token !== input.lockToken) return;
    transaction.update(reference, {
      released_at: new Date(),
      updated_at: new Date(),
    });
  });
};

export const releasePartnerInventoryAttentionLock = async (input: {
  connectionId: string;
  partnerStockId: string;
  requestId: string;
}): Promise<void> => {
  const reference = db
    .collection(LOCKS)
    .doc(lockId(input.connectionId, input.partnerStockId));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data();
    if (
      !snapshot.exists ||
      current?.request_id !== input.requestId ||
      current?.needs_attention !== true
    ) {
      return;
    }
    transaction.update(reference, {
      needs_attention: false,
      released_at: new Date(),
      updated_at: new Date(),
    });
  });
};
