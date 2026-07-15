import { AuditAction } from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { getFacilityAccessMigrationRef } from "../repositories/facilityAccessMigrationRepository.js";
import {
  buildMigrationAudit,
  deterministicAuditId,
} from "./facilityAccessBackfillAudit.js";
import type { DocumentData } from "./facilityAccessBackfillPlanner.js";
import {
  buildMigrationItemProgressDelta,
  type MigrationItemProgress,
  validateMigrationLease,
} from "./facilityAccessBackfillProgress.js";
import { BackfillPreconditionConflictError } from "./facilityAccessBackfillErrors.js";
import type { RuntimeContext } from "./facilityAccessBackfillTypes.js";

interface MutationInput {
  context: RuntimeContext;
  ref: FirebaseFirestore.DocumentReference;
  entityType: string;
  entityId: string;
  warehouseId: string | null;
  patch: DocumentData;
  expected?: DocumentData;
  validateCurrentState?: (
    transaction: FirebaseFirestore.Transaction,
    current: DocumentData,
  ) => Promise<void>;
  progress: MigrationItemProgress;
  action?: AuditAction;
}

const auditRefFor = (
  context: RuntimeContext,
  entityType: string,
  entityId: string,
) =>
  db
    .collection("audit_logs")
    .doc(
      deterministicAuditId(context.options.migrationId, entityType, entityId),
    );

const assertLeaseAndUpdateProgress = (
  transaction: FirebaseFirestore.Transaction,
  context: RuntimeContext,
  progress: MigrationItemProgress,
  plannedWrites: number,
  writtenWrites: number,
  stateRef: FirebaseFirestore.DocumentReference,
  stateSnapshot: FirebaseFirestore.DocumentSnapshot,
): void => {
  const state = stateSnapshot.data();
  const now = new Date();
  const lease = validateMigrationLease(
    {
      exists: stateSnapshot.exists,
      leaseOwner: state?.lease_owner,
      stage: state?.stage,
      leaseExpiresAt: state?.lease_expires_at,
    },
    context.leaseOwner,
    progress.stage,
    now,
  );
  if (!lease.valid) {
    throw new Error("MIGRATION_LEASE_OR_STAGE_LOST");
  }

  const delta = buildMigrationItemProgressDelta(
    progress,
    plannedWrites,
    writtenWrites,
  );
  const issueIncrements = Object.fromEntries(
    Object.entries(delta.issueCountIncrements).map(([code, count]) => [
      `issue_counts.${code}`,
      FieldValue.increment(count),
    ]),
  );
  transaction.update(stateRef, {
    [delta.cursorField]: delta.cursorValue,
    [delta.counterField]: FieldValue.increment(delta.counterIncrement),
    planned_write_count: FieldValue.increment(delta.plannedWriteIncrement),
    written_count: FieldValue.increment(delta.writtenWriteIncrement),
    ...issueIncrements,
    lease_expires_at: new Date(now.getTime() + 5 * 60 * 1000),
    updated_at: now,
    action_time: now,
    sync_time: now,
  });
};

export const commitPatchWithAudit = async ({
  context,
  ref,
  entityType,
  entityId,
  warehouseId,
  patch,
  expected,
  validateCurrentState,
  progress,
  action = AuditAction.UPDATE,
}: MutationInput): Promise<boolean> => {
  if (!context.options.apply) return false;

  return db.runTransaction(async (transaction) => {
    const auditRef = auditRefFor(context, entityType, entityId);
    const stateRef = getFacilityAccessMigrationRef(context.options.migrationId);
    const [snapshot, auditSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(auditRef),
      transaction.get(stateRef),
    ]);
    if (!snapshot.exists)
      throw new Error(`${entityType}:${entityId}:NOT_FOUND`);

    const oldValue: DocumentData = {
      id: snapshot.id,
      ...(snapshot.data() ?? {}),
    };
    if (
      expected &&
      !Object.entries(expected).every(([key, value]) => oldValue[key] === value)
    ) {
      throw new BackfillPreconditionConflictError(
        `${entityType}:${entityId}:PRECONDITION_CONFLICT`,
      );
    }
    await validateCurrentState?.(transaction, oldValue);
    const alreadyApplied = Object.entries(patch).every(
      ([key, value]) => oldValue[key] === value,
    );
    if (alreadyApplied) {
      assertLeaseAndUpdateProgress(
        transaction,
        context,
        progress,
        2,
        0,
        stateRef,
        stateSnapshot,
      );
      return false;
    }

    const now = new Date();
    const appliedPatch = { ...patch, updated_at: now };
    const newValue = { ...oldValue, ...appliedPatch };
    transaction.set(ref, appliedPatch, { merge: true });
    if (!auditSnapshot.exists) {
      transaction.create(
        auditRef,
        buildMigrationAudit({
          id: auditRef.id,
          entityType,
          entityId,
          warehouseId,
          action,
          initiatedBy: context.options.initiatedBy,
          oldValue,
          newValue,
          now,
          migrationId: context.options.migrationId,
        }),
      );
    }
    assertLeaseAndUpdateProgress(
      transaction,
      context,
      progress,
      2,
      auditSnapshot.exists ? 1 : 2,
      stateRef,
      stateSnapshot,
    );
    return true;
  });
};

export const commitCreateWithAudit = async ({
  context,
  ref,
  entityType,
  entityId,
  warehouseId,
  patch,
  progress,
}: MutationInput): Promise<boolean> => {
  if (!context.options.apply) return false;

  return db.runTransaction(async (transaction) => {
    const auditRef = auditRefFor(context, entityType, entityId);
    const stateRef = getFacilityAccessMigrationRef(context.options.migrationId);
    const [snapshot, auditSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(auditRef),
      transaction.get(stateRef),
    ]);
    if (snapshot.exists) {
      assertLeaseAndUpdateProgress(
        transaction,
        context,
        progress,
        2,
        0,
        stateRef,
        stateSnapshot,
      );
      return false;
    }

    const now = new Date();
    transaction.create(ref, patch);
    if (!auditSnapshot.exists) {
      transaction.create(
        auditRef,
        buildMigrationAudit({
          id: auditRef.id,
          entityType,
          entityId,
          warehouseId,
          action: AuditAction.CREATE,
          initiatedBy: context.options.initiatedBy,
          oldValue: null,
          newValue: patch,
          now,
          migrationId: context.options.migrationId,
        }),
      );
    }
    assertLeaseAndUpdateProgress(
      transaction,
      context,
      progress,
      2,
      auditSnapshot.exists ? 1 : 2,
      stateRef,
      stateSnapshot,
    );
    return true;
  });
};

export const commitProgressOnly = async (
  context: RuntimeContext,
  progress: MigrationItemProgress,
): Promise<void> => {
  if (!context.options.apply) return;
  await db.runTransaction(async (transaction) => {
    const stateRef = getFacilityAccessMigrationRef(context.options.migrationId);
    const stateSnapshot = await transaction.get(stateRef);
    assertLeaseAndUpdateProgress(
      transaction,
      context,
      progress,
      0,
      0,
      stateRef,
      stateSnapshot,
    );
  });
};
