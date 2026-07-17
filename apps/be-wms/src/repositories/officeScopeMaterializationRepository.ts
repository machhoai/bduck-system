import {
  AuditAction,
  OFFICE_SCOPE_MATERIALIZATIONS_COLLECTION,
  OFFICE_SCOPE_MATERIALIZATION_JOBS_COLLECTION,
  type OfficeScopeMaterialization,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";
import {
  createInitialOfficeScopeMaterializationState,
  resolveOfficeScopeMaterializationProgress,
} from "../services/officeScopeMaterializationPolicy.js";

interface MaterializationJob {
  id: string;
  office_id: string;
  scope_revision: number;
  requested_user_ids: string[];
  completed_user_ids: string[];
  failed_user_ids: string[];
  errors: Record<string, string>;
}

export interface MaterializationFailure {
  userId: string;
  error: string;
}

const operationId = (officeId: string, revision: number) =>
  `${officeId}_scope_revision_${revision}`;
const publicRef = (officeId: string, revision: number) =>
  db
    .collection(OFFICE_SCOPE_MATERIALIZATIONS_COLLECTION)
    .doc(operationId(officeId, revision));
const jobRef = (officeId: string, revision: number) =>
  db
    .collection(OFFICE_SCOPE_MATERIALIZATION_JOBS_COLLECTION)
    .doc(operationId(officeId, revision));

const mapStatus = (snapshot: FirebaseFirestore.DocumentSnapshot) =>
  mapFirestoreDocument<OfficeScopeMaterialization>(
    snapshot,
    ["started_at", "action_time", "sync_time"],
    ["completed_at"],
  );

const missingError = () => ({
  statusCode: 404,
  messages: {
    vi: "Không tìm thấy trạng thái áp dụng của phiên bản phạm vi này.",
    zh: "未找到此范围版本的应用状态。",
  },
});

const pendingError = () => ({
  statusCode: 409,
  messages: {
    vi: "Phiên bản phạm vi này đang được áp dụng. Vui lòng chờ kết quả hiện tại.",
    zh: "此范围版本正在应用中，请等待当前结果。",
  },
});

export const createOfficeScopeMaterializationInTransaction = (
  transaction: FirebaseFirestore.Transaction,
  input: {
    officeId: string;
    revision: number;
    userIds: readonly string[];
    requestedBy: string;
    actionTime: Date;
    syncTime: Date;
  },
): void => {
  const userIds = Array.from(new Set(input.userIds)).sort();
  const initial = createInitialOfficeScopeMaterializationState(userIds.length);
  const id = operationId(input.officeId, input.revision);
  transaction.create(publicRef(input.officeId, input.revision), {
    id,
    office_id: input.officeId,
    scope_revision: input.revision,
    status: initial.status,
    requested_count: initial.requestedCount,
    completed_count: initial.completedCount,
    failed_count: initial.failedCount,
    attempts: initial.attempts,
    started_at: input.syncTime,
    completed_at: initial.status === "COMPLETED" ? input.syncTime : null,
    requested_by: input.requestedBy,
    last_error: null,
    action_time: input.actionTime,
    sync_time: input.syncTime,
    created_at: input.syncTime,
    updated_at: input.syncTime,
  });
  transaction.create(jobRef(input.officeId, input.revision), {
    id,
    office_id: input.officeId,
    scope_revision: input.revision,
    requested_user_ids: userIds,
    completed_user_ids: [],
    failed_user_ids: [],
    errors: {},
    is_deleted: false,
    created_at: input.syncTime,
    updated_at: input.syncTime,
    action_time: input.actionTime,
    sync_time: input.syncTime,
  });
};

export const findOfficeScopeMaterializations = async (
  officeId: string,
  revisions: readonly number[],
): Promise<Map<number, OfficeScopeMaterialization>> => {
  const uniqueRevisions = Array.from(new Set(revisions)).filter(
    (revision) => Number.isInteger(revision) && revision > 0,
  );
  if (uniqueRevisions.length === 0) return new Map();
  const snapshots = await db.getAll(
    ...uniqueRevisions.map((revision) => publicRef(officeId, revision)),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const status = mapStatus(snapshot);
        return [status.scope_revision, status] as const;
      }),
  );
};

export const claimOfficeScopeMaterializationRetry = async (
  officeId: string,
  revision: number,
  actorId: string,
): Promise<{ status: OfficeScopeMaterialization; userIds: string[] }> =>
  db.runTransaction(async (transaction) => {
    const statusRef = publicRef(officeId, revision);
    const privateRef = jobRef(officeId, revision);
    const [statusSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(statusRef),
      transaction.get(privateRef),
    ]);
    if (!statusSnapshot.exists || !jobSnapshot.exists) throw missingError();
    const status = mapStatus(statusSnapshot);
    const job = jobSnapshot.data() as MaterializationJob;
    if (status.status === "PENDING") throw pendingError();
    if (status.status === "COMPLETED" || job.failed_user_ids.length === 0) {
      return { status, userIds: [] };
    }
    const now = new Date();
    const nextAttempt = status.attempts + 1;
    transaction.update(statusRef, {
      status: "PENDING",
      attempts: nextAttempt,
      started_at: now,
      completed_at: null,
      last_error: null,
      requested_by: actorId,
      updated_at: now,
      action_time: now,
      sync_time: now,
    });
    const auditId = `${status.id}_retry_${nextAttempt}`;
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: OFFICE_SCOPE_MATERIALIZATIONS_COLLECTION,
      entity_id: status.id,
      warehouse_id: officeId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      user_name: null,
      entity_name: status.id,
      action_time: now,
      sync_time: now,
      old_value: status,
      new_value: { status: "PENDING", attempts: nextAttempt },
      ip_address: null,
      device_id: null,
      session_token: null,
      notes: "Retry failed Office scope materialization users",
    });
    return {
      status: { ...status, status: "PENDING", attempts: nextAttempt },
      userIds: [...job.failed_user_ids].sort(),
    };
  });

export const finalizeOfficeScopeMaterialization = async (
  officeId: string,
  revision: number,
  attemptedUserIds: readonly string[],
  failures: readonly MaterializationFailure[],
): Promise<OfficeScopeMaterialization> =>
  db.runTransaction(async (transaction) => {
    const statusRef = publicRef(officeId, revision);
    const privateRef = jobRef(officeId, revision);
    const [statusSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(statusRef),
      transaction.get(privateRef),
    ]);
    if (!statusSnapshot.exists || !jobSnapshot.exists) throw missingError();
    const current = mapStatus(statusSnapshot);
    const job = jobSnapshot.data() as MaterializationJob;
    const progress = resolveOfficeScopeMaterializationProgress(
      {
        requestedUserIds: job.requested_user_ids,
        completedUserIds: job.completed_user_ids,
        failedUserIds: job.failed_user_ids,
        errors: job.errors,
      },
      attemptedUserIds,
      failures,
    );
    const now = new Date();
    const status: OfficeScopeMaterialization = {
      ...current,
      status: progress.status,
      completed_count: progress.completedUserIds.length,
      failed_count: progress.failedUserIds.length,
      completed_at: progress.status === "PENDING" ? null : now,
      last_error:
        progress.failedUserIds.length > 0 ? "USER_ACCESS_REBUILD_FAILED" : null,
      sync_time: now,
    };
    transaction.update(statusRef, {
      status: status.status,
      completed_count: status.completed_count,
      failed_count: status.failed_count,
      completed_at: status.completed_at,
      last_error: status.last_error,
      updated_at: now,
      sync_time: now,
    });
    transaction.update(privateRef, {
      completed_user_ids: progress.completedUserIds,
      failed_user_ids: progress.failedUserIds,
      errors: progress.errors,
      updated_at: now,
      sync_time: now,
    });
    return status;
  });
