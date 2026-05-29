/**
 * Approval Repository — Firestore CRUD for pending_approvals
 *
 * Collection: pending_approvals
 *
 * This replaces the old workflow_instances/{id}/tasks subcollection.
 * Flat collection for simpler querying (no collectionGroup index needed).
 *
 * INDEXES REQUIRED:
 *   (role_id, status) — for TaskInbox queries
 *   (entity_type, entity_id, level) — for per-voucher approval chain
 */

import { db } from "../config/firebase.js";
import type {
  ApprovalRecord,
  ProcessEntityType,
} from "@bduck/shared-types";

const COLLECTION = "pending_approvals";

/**
 * Create multiple approval records in a batch (one per level).
 * Called when a voucher is submitted for approval.
 */
export async function createBatch(
  records: ApprovalRecord[],
): Promise<void> {
  const batch = db.batch();

  for (const record of records) {
    const ref = db.collection(COLLECTION).doc(record.id);
    batch.set(ref, record);
  }

  await batch.commit();
}

/**
 * Find pending approvals assigned to any of the given role IDs.
 * Used by the Tasks page (replaces useWorkflowTasks collectionGroup query).
 */
export async function findPendingByRoleIds(
  roleIds: string[],
): Promise<ApprovalRecord[]> {
  if (roleIds.length === 0) return [];

  // Firestore "in" supports up to 30 values
  const snap = await db
    .collection(COLLECTION)
    .where("role_id", "in", roleIds)
    .where("status", "==", "PENDING")
    .get();

  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as ApprovalRecord,
  );
}

/**
 * Find all approval records for a specific entity.
 * Returns sorted by level ascending.
 */
export async function findByEntity(
  entityType: ProcessEntityType,
  entityId: string,
): Promise<ApprovalRecord[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("entity_type", "==", entityType)
    .where("entity_id", "==", entityId)
    .get();

  const records = snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as ApprovalRecord,
  );

  return records.sort((a, b) => a.level - b.level);
}

/**
 * Find a single approval record by ID.
 */
export async function findById(
  id: string,
): Promise<ApprovalRecord | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ApprovalRecord;
}

/**
 * Update approval record status (APPROVED / REJECTED).
 */
export async function updateStatus(
  id: string,
  data: {
    status: "APPROVED" | "REJECTED";
    approver_id: string;
    approved_at: Date;
    rejected_reason?: string | null;
    comments?: string | null;
    action_time: Date;
    sync_time: Date;
  },
): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}

/**
 * Count how many records at a given level+entity are APPROVED.
 * Used to check if min_approvers threshold is met.
 */
export async function countApprovedAtLevel(
  entityType: ProcessEntityType,
  entityId: string,
  level: number,
): Promise<number> {
  const snap = await db
    .collection(COLLECTION)
    .where("entity_type", "==", entityType)
    .where("entity_id", "==", entityId)
    .where("level", "==", level)
    .where("status", "==", "APPROVED")
    .get();

  return snap.size;
}

/**
 * Check if ALL active levels for an entity are fully approved.
 */
export async function isFullyApproved(
  entityType: ProcessEntityType,
  entityId: string,
): Promise<boolean> {
  const allRecords = await findByEntity(entityType, entityId);
  if (allRecords.length === 0) return false;

  return allRecords.every((r) => r.status === "APPROVED");
}

/**
 * Mark all PENDING records for an entity as REJECTED.
 * Called when a rejection cascades to cancel remaining levels.
 */
export async function rejectAllPending(
  entityType: ProcessEntityType,
  entityId: string,
  rejectedBy: string,
  reason: string,
): Promise<void> {
  const pendingRecords = (await findByEntity(entityType, entityId)).filter(
    (r) => r.status === "PENDING",
  );

  if (pendingRecords.length === 0) return;

  const now = new Date();
  const batch = db.batch();

  for (const record of pendingRecords) {
    batch.update(db.collection(COLLECTION).doc(record.id), {
      status: "REJECTED",
      approver_id: rejectedBy,
      approved_at: now,
      rejected_reason: reason,
      sync_time: now,
    });
  }

  await batch.commit();
}
