import { createHash } from "node:crypto";

import type {
  AuditAction,
  EmployeeContractDocument,
  EmployeeContractDocumentUploadIntent,
} from "@bduck/shared-types";


import { db } from "../config/firebase.js";

import type {
  EmployeeContractAuditMetadata,
  EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import {
  mapFirestoreDocument,
  toFirestoreDate,
} from "./facilityAccessRepositoryUtils.js";

export const EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION =
  "employee_contract_documents";
export const EMPLOYEE_CONTRACT_DOCUMENT_UPLOAD_INTENTS_COLLECTION =
  "employee_contract_document_upload_intents";
export const EMPLOYEE_CONTRACT_DOCUMENT_LOCKS_COLLECTION =
  "employee_contract_document_locks";

const DOCUMENT_DATE_FIELDS = [
  "created_at",
  "updated_at",
  "action_time",
  "sync_time",
];
const INTENT_DATE_FIELDS = [...DOCUMENT_DATE_FIELDS, "expires_at"];

export interface EmployeeContractDocumentContext extends EmployeeContractAuditMetadata {
  actor_id: string;
  action_time: Date;
  idempotency_key: string;
}

export const employeeContractDocumentRef = (documentId: string) =>
  db.collection(EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION).doc(documentId);

export const employeeContractDocumentIntentRef = (intentId: string) =>
  db
    .collection(EMPLOYEE_CONTRACT_DOCUMENT_UPLOAD_INTENTS_COLLECTION)
    .doc(intentId);

export const employeeContractDocumentLockRef = (contractId: string) =>
  db.collection(EMPLOYEE_CONTRACT_DOCUMENT_LOCKS_COLLECTION).doc(contractId);

export const mapEmployeeContractDocumentSnapshot = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeContractDocument =>
  mapFirestoreDocument<EmployeeContractDocument>(
    snapshot,
    DOCUMENT_DATE_FIELDS,
  );

export const mapEmployeeContractDocumentIntentSnapshot = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeContractDocumentUploadIntent =>
  mapFirestoreDocument<EmployeeContractDocumentUploadIntent>(
    snapshot,
    INTENT_DATE_FIELDS,
    ["finalized_at"],
  );

export const findEmployeeContractDocumentIntentById = async (
  intentId: string,
): Promise<EmployeeContractDocumentUploadIntent | null> => {
  const snapshot = await employeeContractDocumentIntentRef(intentId).get();
  if (!snapshot.exists) return null;
  const intent = mapEmployeeContractDocumentIntentSnapshot(snapshot);
  return intent.is_deleted ? null : intent;
};

export const findEmployeeContractDocumentById = async (
  documentId: string,
): Promise<EmployeeContractDocument | null> => {
  const snapshot = await employeeContractDocumentRef(documentId).get();
  if (!snapshot.exists) return null;
  const document = mapEmployeeContractDocumentSnapshot(snapshot);
  return document.is_deleted ? null : document;
};

export const findEmployeeContractDocuments = async (
  contractId: string,
): Promise<EmployeeContractDocument[]> => {
  const snapshot = await db
    .collection(EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION)
    .where("contract_id", "==", contractId)
    .get();
  return snapshot.docs
    .map(mapEmployeeContractDocumentSnapshot)
    .filter((document) => !document.is_deleted)
    .sort((left, right) => right.version - left.version);
};

export const mapStoredEmployeeContractDocument = (
  value: Record<string, unknown>,
): EmployeeContractDocument => {
  const mapped = { ...value };
  DOCUMENT_DATE_FIELDS.forEach((field) => {
    mapped[field] = toFirestoreDate(mapped[field]);
  });
  return mapped as unknown as EmployeeContractDocument;
};

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const hashEmployeeContractDocumentRequest = (input: {
  employee_profile_id: string;
  contract_id: string;
  original_file_name: string;
}): string =>
  hash(
    JSON.stringify({
      contract_id: input.contract_id,
      employee_profile_id: input.employee_profile_id,
      original_file_name: input.original_file_name,
    }),
  );

export const writeEmployeeContractDocumentVersionLock = (
  transaction: FirebaseFirestore.Transaction,
  snapshot: FirebaseFirestore.DocumentSnapshot,
  document: EmployeeContractDocument,
  context: EmployeeContractOperationContext,
  syncTime: Date,
) => {
  transaction.set(
    employeeContractDocumentLockRef(document.contract_id),
    {
      id: document.contract_id,
      contract_id: document.contract_id,
      last_document_id: document.id,
      last_version: document.version,
      created_by: snapshot.exists
        ? snapshot.get("created_by")
        : context.actor_id,
      created_at: snapshot.exists ? snapshot.get("created_at") : syncTime,
      updated_by: context.actor_id,
      updated_at: syncTime,
      action_time: context.action_time,
      sync_time: syncTime,
      is_deleted: false,
    },
    { merge: true },
  );
};

export const writeEmployeeContractDocumentAudit = (
  transaction: FirebaseFirestore.Transaction,
  id: string,
  action: AuditAction,
  context: EmployeeContractOperationContext,
  entityType: string,
  entityId: string,
  warehouseId: string,
  entityName: string,
  oldValue: unknown,
  newValue: unknown,
  syncTime: Date,
  notes: string,
) => {
  transaction.create(db.collection("audit_logs").doc(id), {
    id,
    entity_type: entityType,
    entity_id: entityId,
    warehouse_id: warehouseId,
    action,
    user_id: context.actor_id,
    user_name: null,
    entity_name: entityName,
    action_time: context.action_time,
    sync_time: syncTime,
    old_value: oldValue,
    new_value: newValue,
    ip_address: context.ip_address ?? null,
    device_id: context.device_id ?? null,
    session_token: context.session_token ? hash(context.session_token) : null,
    notes,
  });
};
