import {
  LEAVE_IMPORT_TEMPLATE_VERSION,
  LeaveImportBatchStatus,
  type LeaveImportBatch,
  type LeaveImportRow,
  type LocalizedText,
} from "@bduck/shared-types";
import { randomUUID } from "node:crypto";
import { db } from "../config/firebase.js";

const BATCH_COLLECTION = "leave_import_batches";
const ROW_COLLECTION = "leave_import_rows";

const withBatchId = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): LeaveImportBatch => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<LeaveImportBatch, "id">),
});

const withRowId = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): LeaveImportRow => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<LeaveImportRow, "id">),
});

const timestampMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return new Date(String(value)).getTime() || 0;
};

export const createLeaveImportPreview = async (input: {
  source_file_name: string;
  source_file_url: string;
  source_file_checksum: string;
  workplace_warehouse_ids: string[];
  actor_id: string;
  action_time: Date;
  rows: Array<
    Pick<
      LeaveImportRow,
      | "row_number"
      | "record_type"
      | "source_reference"
      | "employee_code"
      | "normalized_payload"
      | "is_valid"
      | "validation_messages"
    >
  >;
}): Promise<{ batch: LeaveImportBatch; rows: LeaveImportRow[] }> => {
  const now = new Date();
  const batchId = randomUUID();
  const batch: LeaveImportBatch = {
    id: batchId,
    status: LeaveImportBatchStatus.PREVIEWED,
    template_version: LEAVE_IMPORT_TEMPLATE_VERSION,
    source_file_name: input.source_file_name,
    source_file_url: input.source_file_url,
    source_file_checksum: input.source_file_checksum,
    workplace_warehouse_ids: [...input.workplace_warehouse_ids].sort(),
    total_rows: input.rows.length,
    valid_rows: input.rows.filter((row) => row.is_valid).length,
    invalid_rows: input.rows.filter((row) => !row.is_valid).length,
    committed_rows: 0,
    created_by: input.actor_id,
    committed_at: null,
    failure_message: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  };
  const rows = input.rows.map<LeaveImportRow>((row) => ({
    id: `${batchId}_${row.row_number}`,
    batch_id: batchId,
    ...row,
    committed_at: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  }));
  const writeBatch = db.batch();
  writeBatch.set(db.collection(BATCH_COLLECTION).doc(batchId), batch);
  rows.forEach((row) =>
    writeBatch.set(db.collection(ROW_COLLECTION).doc(row.id), row),
  );
  await writeBatch.commit();
  return { batch, rows };
};

export const findLeaveImportBatch = async (
  batchId: string,
): Promise<LeaveImportBatch | null> => {
  const snapshot = await db.collection(BATCH_COLLECTION).doc(batchId).get();
  if (!snapshot.exists) return null;
  const batch = withBatchId(snapshot);
  return batch.is_deleted ? null : batch;
};

export const findLeaveImportRows = async (
  batchId: string,
): Promise<LeaveImportRow[]> => {
  const snapshot = await db
    .collection(ROW_COLLECTION)
    .where("batch_id", "==", batchId)
    .get();
  return snapshot.docs
    .map(withRowId)
    .filter((row) => !row.is_deleted)
    .sort((left, right) => left.row_number - right.row_number);
};

export const findLeaveImportBatches = async (
  limit = 30,
): Promise<LeaveImportBatch[]> => {
  const snapshot = await db
    .collection(BATCH_COLLECTION)
    .where("is_deleted", "==", false)
    .get();
  return snapshot.docs
    .map(withBatchId)
    .sort(
      (left, right) =>
        timestampMillis(right.created_at) -
        timestampMillis(left.created_at),
    )
    .slice(0, limit);
};

const transitionBatch = async (
  batchId: string,
  update: {
    status: LeaveImportBatchStatus;
    committed_rows?: number;
    committed_at?: Date | null;
    failure_message?: LocalizedText | null;
    action_time: Date;
  },
): Promise<LeaveImportBatch> =>
  db.runTransaction(async (transaction) => {
    const reference = db.collection(BATCH_COLLECTION).doc(batchId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error("LEAVE_IMPORT_BATCH_NOT_FOUND");
    const current = withBatchId(snapshot);
    const next: LeaveImportBatch = {
      ...current,
      status: update.status,
      committed_rows: update.committed_rows ?? current.committed_rows,
      committed_at:
        update.committed_at === undefined
          ? current.committed_at
          : update.committed_at,
      failure_message:
        update.failure_message === undefined
          ? current.failure_message
          : update.failure_message,
      updated_at: new Date(),
      action_time: update.action_time,
      sync_time: new Date(),
    };
    transaction.set(reference, next);
    return next;
  });

export const markLeaveImportCommitting = (
  batchId: string,
  actionTime: Date,
) =>
  transitionBatch(batchId, {
    status: LeaveImportBatchStatus.COMMITTING,
    failure_message: null,
    action_time: actionTime,
  });

export const markLeaveImportCommitted = (
  batchId: string,
  committedRows: number,
  actionTime: Date,
) =>
  transitionBatch(batchId, {
    status: LeaveImportBatchStatus.COMMITTED,
    committed_rows: committedRows,
    committed_at: new Date(),
    failure_message: null,
    action_time: actionTime,
  });

export const markLeaveImportFailed = (
  batchId: string,
  committedRows: number,
  failureMessage: LocalizedText,
  actionTime: Date,
) =>
  transitionBatch(batchId, {
    status: LeaveImportBatchStatus.FAILED,
    committed_rows: committedRows,
    failure_message: failureMessage,
    action_time: actionTime,
  });
