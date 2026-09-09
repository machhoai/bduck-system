import { randomUUID } from "node:crypto";

import {
  AuditAction,
  EmployeeIdentitySyncJobStatus,
  type EmployeeIdentitySyncJob,
} from "@bduck/shared-types";

import { auth, db } from "../config/firebase.js";

const COLLECTION = "employee_identity_sync_jobs";
const LEASE_MS = 2 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const mapJob = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeIdentitySyncJob => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<EmployeeIdentitySyncJob, "id">),
});

const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message.slice(0, 1000)
    : "IDENTITY_SYNC_FAILED";

const isFirebaseUserMissing = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "auth/user-not-found",
  );

const writeJobAudit = (
  transaction: FirebaseFirestore.Transaction,
  before: EmployeeIdentitySyncJob,
  after: EmployeeIdentitySyncJob,
  actorId: string,
  notes: string,
) => {
  const auditRef = db.collection("audit_logs").doc(randomUUID());
  transaction.create(auditRef, {
    id: auditRef.id,
    entity_type: COLLECTION,
    entity_id: after.id,
    warehouse_id: null,
    action: AuditAction.UPDATE,
    user_id: actorId,
    user_name: null,
    entity_name: null,
    action_time: after.action_time,
    sync_time: after.sync_time,
    old_value: before,
    new_value: after,
    ip_address: null,
    device_id: null,
    session_token: null,
    notes,
  });
};

const claimJob = async (
  jobId: string,
  now: Date,
): Promise<EmployeeIdentitySyncJob | null> => {
  const ref = db.collection(COLLECTION).doc(jobId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const job = mapJob(snapshot);
    if (
      job.is_deleted ||
      job.status === EmployeeIdentitySyncJobStatus.SUCCEEDED
    ) {
      return null;
    }
    const leaseExpiresAt = toDate(job.lease_expires_at);
    if (
      job.status === EmployeeIdentitySyncJobStatus.PROCESSING &&
      leaseExpiresAt &&
      leaseExpiresAt > now
    ) {
      return null;
    }
    const nextRetryAt = toDate(job.next_retry_at);
    if (nextRetryAt && nextRetryAt > now) return null;

    const claimed: EmployeeIdentitySyncJob = {
      ...job,
      status: EmployeeIdentitySyncJobStatus.PROCESSING,
      lease_expires_at: new Date(now.getTime() + LEASE_MS),
      updated_at: now,
      sync_time: now,
    };
    transaction.update(ref, {
      status: claimed.status,
      lease_expires_at: claimed.lease_expires_at,
      updated_at: now,
      sync_time: now,
    });
    writeJobAudit(
      transaction,
      job,
      claimed,
      "system:identity-sync",
      "Claim Firebase Authentication synchronization job",
    );
    return claimed;
  });
};

const completeJob = async (job: EmployeeIdentitySyncJob, syncTime: Date) => {
  const ref = db.collection(COLLECTION).doc(job.id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const before = mapJob(snapshot);
    const after: EmployeeIdentitySyncJob = {
      ...before,
      ...job,
      status: EmployeeIdentitySyncJobStatus.SUCCEEDED,
      lease_expires_at: null,
      last_error: null,
      completed_at: syncTime,
      updated_at: syncTime,
      sync_time: syncTime,
    };
    transaction.update(ref, {
      status: after.status,
      lease_expires_at: null,
      last_error: null,
      completed_at: syncTime,
      updated_at: syncTime,
      sync_time: syncTime,
    });
    writeJobAudit(
      transaction,
      before,
      after,
      "system:identity-sync",
      "Firebase Authentication deactivation synchronized",
    );
  });
};

const failJob = async (
  job: EmployeeIdentitySyncJob,
  error: unknown,
  syncTime: Date,
) => {
  const retryCount = job.retry_count + 1;
  const delayMs = Math.min(
    MAX_RETRY_DELAY_MS,
    30_000 * 2 ** Math.min(retryCount - 1, 7),
  );
  const message = errorMessage(error);
  const ref = db.collection(COLLECTION).doc(job.id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const before = mapJob(snapshot);
    const after: EmployeeIdentitySyncJob = {
      ...before,
      status: EmployeeIdentitySyncJobStatus.FAILED,
      retry_count: retryCount,
      next_retry_at: new Date(syncTime.getTime() + delayMs),
      lease_expires_at: null,
      last_error: message,
      updated_at: syncTime,
      sync_time: syncTime,
    };
    transaction.update(ref, {
      status: after.status,
      retry_count: after.retry_count,
      next_retry_at: after.next_retry_at,
      lease_expires_at: null,
      last_error: after.last_error,
      updated_at: syncTime,
      sync_time: syncTime,
    });
    writeJobAudit(
      transaction,
      before,
      after,
      "system:identity-sync",
      "Firebase Authentication synchronization failed; retry scheduled",
    );
  });
  console.error("[employeeIdentitySyncService] identity sync failed", {
    jobId: job.id,
    userId: job.employee_user_id,
    retryCount,
    error,
  });
};

export const processEmployeeIdentitySyncJob = async (
  jobId: string,
): Promise<"SUCCEEDED" | "FAILED" | "SKIPPED"> => {
  const job = await claimJob(jobId, new Date());
  if (!job) return "SKIPPED";

  try {
    try {
      await auth.updateUser(job.employee_user_id, {
        disabled: job.desired_disabled,
      });
      if (job.desired_disabled) {
        await auth.revokeRefreshTokens(job.employee_user_id);
      }
    } catch (error) {
      if (!isFirebaseUserMissing(error)) throw error;
    }
    await completeJob(job, new Date());
    return "SUCCEEDED";
  } catch (error) {
    await failJob(job, error, new Date());
    return "FAILED";
  }
};

export const processPendingEmployeeIdentitySyncJobs = async (
  limit = 100,
): Promise<{ processed: number; succeeded: number; failed: number }> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "in", [
      EmployeeIdentitySyncJobStatus.PENDING,
      EmployeeIdentitySyncJobStatus.PROCESSING,
      EmployeeIdentitySyncJobStatus.FAILED,
    ])
    .limit(Math.min(Math.max(limit, 1), 200))
    .get();
  const now = new Date();
  const dueJobs = snapshot.docs.map(mapJob).filter((job) => {
    if (job.is_deleted) return false;
    const retryAt = toDate(job.next_retry_at);
    const leaseAt = toDate(job.lease_expires_at);
    if (
      job.status === EmployeeIdentitySyncJobStatus.PROCESSING &&
      leaseAt &&
      leaseAt > now
    ) {
      return false;
    }
    return !retryAt || retryAt <= now;
  });

  let succeeded = 0;
  let failed = 0;
  for (const job of dueJobs) {
    const result = await processEmployeeIdentitySyncJob(job.id);
    if (result === "SUCCEEDED") succeeded += 1;
    if (result === "FAILED") failed += 1;
  }
  return { processed: dueJobs.length, succeeded, failed };
};
