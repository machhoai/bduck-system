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
import type { ApprovalRecord, ProcessEntityType } from "@bduck/shared-types";

const COLLECTION = "pending_approvals";

const getApprovalAttempt = (record: Pick<ApprovalRecord, "approval_attempt">) =>
  record.approval_attempt ?? 1;

/**
 * Create multiple approval records in a batch (one per level).
 * Called when a voucher is submitted for approval.
 */
export async function createBatch(records: ApprovalRecord[]): Promise<void> {
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

  const records: ApprovalRecord[] = [];
  const uniqueRoleIds = Array.from(new Set(roleIds.filter(Boolean)));

  for (let index = 0; index < uniqueRoleIds.length; index += 30) {
    const chunk = uniqueRoleIds.slice(index, index + 30);
    const snap = await db
      .collection(COLLECTION)
      .where("role_id", "in", chunk)
      .where("status", "==", "PENDING")
      .get();

    records.push(
      ...snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ApprovalRecord,
      ),
    );
  }

  return records;
}

export async function findPendingByRolesAndFacilities(
  roleIds: readonly string[],
  facilityIds: readonly string[],
): Promise<ApprovalRecord[]> {
  const roles = Array.from(new Set(roleIds.filter(Boolean)));
  const facilities = Array.from(new Set(facilityIds.filter(Boolean)));
  if (roles.length === 0 || facilities.length === 0) return [];

  const records = new Map<string, ApprovalRecord>();
  for (const facilityId of facilities) {
    for (let index = 0; index < roles.length; index += 30) {
      const roleChunk = roles.slice(index, index + 30);
      for (const field of ["approval_warehouse_id", "warehouse_id"] as const) {
        const snapshot = await db
          .collection(COLLECTION)
          .where("role_id", "in", roleChunk)
          .where(field, "==", facilityId)
          .where("status", "==", "PENDING")
          .get();
        snapshot.docs.forEach((document) => {
          records.set(document.id, {
            id: document.id,
            ...document.data(),
          } as ApprovalRecord);
        });
      }
    }
  }
  return [...records.values()];
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

  return records.sort((a, b) => {
    const attemptDelta = getApprovalAttempt(a) - getApprovalAttempt(b);
    if (attemptDelta !== 0) return attemptDelta;
    return a.level - b.level;
  });
}

/**
 * Find a single approval record by ID.
 */
export async function findById(id: string): Promise<ApprovalRecord | null> {
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
    status: "APPROVED" | "REJECTED" | "PENDING";
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
  approvalAttempt?: number,
): Promise<number> {
  return (await findByEntity(entityType, entityId)).filter((record) => {
    if (approvalAttempt && getApprovalAttempt(record) !== approvalAttempt) {
      return false;
    }
    return record.level === level && record.status === "APPROVED";
  }).length;
}

/**
 * Check if ALL active levels for an entity are fully approved.
 */
export async function isFullyApproved(
  entityType: ProcessEntityType,
  entityId: string,
  approvalAttempt?: number,
): Promise<boolean> {
  const allRecords = (await findByEntity(entityType, entityId)).filter(
    (record) =>
      !approvalAttempt || getApprovalAttempt(record) === approvalAttempt,
  );
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
  approvalAttempt?: number,
): Promise<void> {
  const pendingRecords = (await findByEntity(entityType, entityId)).filter(
    (r) =>
      r.status === "PENDING" &&
      (!approvalAttempt || getApprovalAttempt(r) === approvalAttempt),
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
