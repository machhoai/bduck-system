import {
  AuditAction,
  EMPLOYEE_CONTRACT_IMPORT_TEMPLATE_VERSION,
  EmployeeContractImportBatchStatus,
  EmployeeContractImportRowStatus,
  type EmployeeContractImportBatch,
  type EmployeeContractImportRow,
  type LocalizedText,
} from "@bduck/shared-types";
import { randomUUID } from "node:crypto";

import { db } from "../config/firebase.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

export const EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION =
  "employee_contract_import_batches";
export const EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION =
  "employee_contract_import_rows";

const DATE_FIELDS = ["created_at", "updated_at", "action_time", "sync_time"];
const NULLABLE_BATCH_DATES = ["committed_at"];
const NULLABLE_ROW_DATES = ["committed_at"];

export const mapEmployeeContractImportBatch = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeContractImportBatch =>
  mapFirestoreDocument<EmployeeContractImportBatch>(
    snapshot,
    DATE_FIELDS,
    NULLABLE_BATCH_DATES,
  );

export const mapEmployeeContractImportRow = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeContractImportRow =>
  mapFirestoreDocument<EmployeeContractImportRow>(
    snapshot,
    DATE_FIELDS,
    NULLABLE_ROW_DATES,
  );

const writeAudit = (
  batch: FirebaseFirestore.WriteBatch,
  input: {
    id: string;
    entityType: string;
    entityId: string;
    warehouseId: string | null;
    actorId: string;
    actionTime: Date;
    value: unknown;
    name: string;
  },
) => {
  const now = new Date();
  batch.create(db.collection("audit_logs").doc(input.id), {
    id: input.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    warehouse_id: input.warehouseId,
    action: AuditAction.CREATE,
    user_id: input.actorId,
    user_name: null,
    entity_name: input.name,
    action_time: input.actionTime,
    sync_time: now,
    old_value: null,
    new_value: input.value,
    ip_address: null,
    device_id: null,
    session_token: null,
    notes: "Employee contract history import preview",
  });
};

export const createEmployeeContractImportPreview = async (input: {
  source_file_name: string;
  source_file_path: string;
  source_file_checksum: string;
  upload_session_id: string;
  workplace_warehouse_ids: string[];
  actor_id: string;
  action_time: Date;
  rows: Array<
    Pick<
      EmployeeContractImportRow,
      | "row_number"
      | "source_reference"
      | "employee_code"
      | "employee_profile_id"
      | "workplace_warehouse_id"
      | "normalized_payload"
      | "status"
      | "validation_messages"
      | "staged_document"
    >
  >;
}): Promise<{
  batch: EmployeeContractImportBatch;
  rows: EmployeeContractImportRow[];
}> => {
  const now = new Date();
  const batchId = randomUUID();
  const validRows = input.rows.filter(
    (row) => row.status === EmployeeContractImportRowStatus.VALID,
  ).length;
  const batch: EmployeeContractImportBatch = {
    id: batchId,
    template_version: EMPLOYEE_CONTRACT_IMPORT_TEMPLATE_VERSION,
    source_file_name: input.source_file_name,
    source_file_path: input.source_file_path,
    source_file_checksum: input.source_file_checksum,
    upload_session_id: input.upload_session_id,
    status: EmployeeContractImportBatchStatus.PREVIEWED,
    workplace_warehouse_ids: [...input.workplace_warehouse_ids].sort(),
    total_rows: input.rows.length,
    valid_rows: validRows,
    invalid_rows: input.rows.length - validRows,
    committed_rows: 0,
    failed_rows: 0,
    created_by: input.actor_id,
    committed_by: null,
    committed_at: null,
    failure_message: null,
    commit_idempotency_key: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  };
  const rows = input.rows.map<EmployeeContractImportRow>((row) => ({
    id: `${batchId}_${row.row_number}`,
    batch_id: batchId,
    ...row,
    contract_id: null,
    document_id: null,
    error_code: null,
    committed_at: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  }));
  const writeBatch = db.batch();
  writeBatch.create(
    db.collection(EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION).doc(batchId),
    batch,
  );
  writeAudit(writeBatch, {
    id: `contract-import:${batchId}:preview`,
    entityType: EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION,
    entityId: batchId,
    warehouseId: null,
    actorId: input.actor_id,
    actionTime: input.action_time,
    value: batch,
    name: input.source_file_name,
  });
  rows.forEach((row) => {
    writeBatch.create(
      db.collection(EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION).doc(row.id),
      row,
    );
    writeAudit(writeBatch, {
      id: `contract-import:${row.id}:preview`,
      entityType: EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION,
      entityId: row.id,
      warehouseId: row.workplace_warehouse_id,
      actorId: input.actor_id,
      actionTime: input.action_time,
      value: row,
      name: row.source_reference,
    });
  });
  await writeBatch.commit();
  return { batch, rows };
};

export const findEmployeeContractImportBatch = async (
  id: string,
): Promise<EmployeeContractImportBatch | null> => {
  const snapshot = await db
    .collection(EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION)
    .doc(id)
    .get();
  return snapshot.exists && snapshot.get("is_deleted") !== true
    ? mapEmployeeContractImportBatch(snapshot)
    : null;
};

export const findEmployeeContractImportRows = async (
  batchId: string,
): Promise<EmployeeContractImportRow[]> => {
  const snapshot = await db
    .collection(EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION)
    .where("batch_id", "==", batchId)
    .get();
  return snapshot.docs
    .map(mapEmployeeContractImportRow)
    .filter((row) => !row.is_deleted)
    .sort((left, right) => left.row_number - right.row_number);
};

export const transitionEmployeeContractImportBatch = async (input: {
  batch_id: string;
  actor_id: string;
  action_time: Date;
  status: EmployeeContractImportBatchStatus;
  idempotency_key?: string;
  committed_rows?: number;
  failed_rows?: number;
  failure_message?: LocalizedText | null;
}): Promise<EmployeeContractImportBatch> =>
  db.runTransaction(async (transaction) => {
    const ref = db
      .collection(EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION)
      .doc(input.batch_id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("CONTRACT_IMPORT_BATCH_NOT_FOUND");
    const current = mapEmployeeContractImportBatch(snapshot);
    if (
      current.commit_idempotency_key &&
      input.idempotency_key &&
      current.commit_idempotency_key !== input.idempotency_key
    ) {
      throw {
        code: "CONTRACT_IMPORT_IDEMPOTENCY_CONFLICT",
        statusCode: 409,
        messages: {
          vi: "Batch đã được commit bằng một khóa chống trùng khác.",
          zh: "该批次已使用其他幂等键提交。",
        },
      };
    }
    const now = new Date();
    const next: EmployeeContractImportBatch = {
      ...current,
      status: input.status,
      committed_rows: input.committed_rows ?? current.committed_rows,
      failed_rows: input.failed_rows ?? current.failed_rows,
      committed_by:
        input.status === EmployeeContractImportBatchStatus.COMPLETED
          ? input.actor_id
          : current.committed_by,
      committed_at:
        input.status === EmployeeContractImportBatchStatus.COMPLETED
          ? now
          : current.committed_at,
      failure_message:
        input.failure_message === undefined
          ? current.failure_message
          : input.failure_message,
      commit_idempotency_key:
        input.idempotency_key ?? current.commit_idempotency_key,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    transaction.set(ref, next);
    transaction.set(
      db.collection("audit_logs").doc(
        `contract-import:${input.batch_id}:${input.status.toLowerCase()}`,
      ),
      {
        id: `contract-import:${input.batch_id}:${input.status.toLowerCase()}`,
        entity_type: EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION,
        entity_id: input.batch_id,
        warehouse_id: null,
        action: AuditAction.UPDATE,
        user_id: input.actor_id,
        user_name: null,
        entity_name: current.source_file_name,
        action_time: input.action_time,
        sync_time: now,
        old_value: current,
        new_value: next,
        ip_address: null,
        device_id: null,
        session_token: null,
        notes: `Employee contract import ${input.status.toLowerCase()}`,
      },
    );
    return next;
  });
