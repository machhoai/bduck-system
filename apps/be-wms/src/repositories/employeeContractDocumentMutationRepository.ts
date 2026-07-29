import { randomUUID } from "node:crypto";

import {
  AuditAction,
  EmployeeContractDocumentUploadIntentStatus,
  type EmployeeContractDocument,
  type EmployeeContractDocumentMutationResult,
  type EmployeeContractDocumentUploadIntent,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import type { PersistedEmployeeContractPdf } from "../services/employeeContractDocumentStorageService.js";

import {
  EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION,
  EMPLOYEE_CONTRACT_DOCUMENT_UPLOAD_INTENTS_COLLECTION,
  employeeContractDocumentIntentRef,
  employeeContractDocumentLockRef,
  employeeContractDocumentRef,
  mapEmployeeContractDocumentIntentSnapshot,
  mapEmployeeContractDocumentSnapshot,
  writeEmployeeContractDocumentAudit,
  writeEmployeeContractDocumentVersionLock,
} from "./employeeContractDocumentRepository.js";
import {
  contractError,
  employeeContractRef,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import {
  assertEmployeeContractForProfile,
  assertEmployeeContractWorkplace,
} from "./employeeContractRepositoryGuards.js";

export const finalizeEmployeeContractDocumentRecord = async (input: {
  employee_profile_id: string;
  workplace_warehouse_id: string;
  contract_id: string;
  intent_id: string;
  persisted: PersistedEmployeeContractPdf;
  context: EmployeeContractOperationContext;
}): Promise<EmployeeContractDocumentMutationResult> => {
  const documentId = randomUUID();
  return db.runTransaction(async (transaction) => {
    const intentRef = employeeContractDocumentIntentRef(input.intent_id);
    const contractRef = employeeContractRef(input.contract_id);
    const versionLockRef = employeeContractDocumentLockRef(input.contract_id);
    const documentsQuery = db
      .collection(EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION)
      .where("contract_id", "==", input.contract_id);
    const [
      intentSnapshot,
      contractSnapshot,
      versionLockSnapshot,
      documentSnapshots,
    ] = await Promise.all([
      transaction.get(intentRef),
      transaction.get(contractRef),
      transaction.get(versionLockRef),
      transaction.get(documentsQuery),
    ]);
    if (!intentSnapshot.exists) {
      throw contractError(
        "CONTRACT_DOCUMENT_INTENT_NOT_FOUND",
        {
          vi: "Không tìm thấy yêu cầu tải tệp hợp đồng.",
          zh: "未找到合同文件上传请求。",
        },
        404,
      );
    }
    const intent = mapEmployeeContractDocumentIntentSnapshot(intentSnapshot);
    if (
      intent.contract_id !== input.contract_id ||
      intent.employee_profile_id !== input.employee_profile_id ||
      intent.created_by !== input.context.actor_id ||
      intent.is_deleted
    ) {
      throw contractError(
        "CONTRACT_DOCUMENT_INTENT_NOT_FOUND",
        {
          vi: "Không tìm thấy yêu cầu tải tệp hợp đồng phù hợp.",
          zh: "未找到匹配的合同文件上传请求。",
        },
        404,
      );
    }
    if (intent.finalized_document_id) {
      const finalized = documentSnapshots.docs.find(
        (snapshot) => snapshot.id === intent.finalized_document_id,
      );
      if (!finalized) {
        throw contractError(
          "CONTRACT_DOCUMENT_FINALIZE_CORRUPTED",
          {
            vi: "Không thể đọc kết quả hoàn tất tệp hợp đồng trước đó.",
            zh: "无法读取先前的合同文件完成结果。",
          },
          500,
        );
      }
      return {
        document: mapEmployeeContractDocumentSnapshot(finalized),
        replayed: true,
      };
    }
    if (
      intent.status !== EmployeeContractDocumentUploadIntentStatus.PENDING ||
      intent.expires_at.getTime() <= Date.now()
    ) {
      throw contractError("CONTRACT_DOCUMENT_INTENT_EXPIRED", {
        vi: "Yêu cầu tải tệp hợp đồng đã hết hạn hoặc không còn hiệu lực.",
        zh: "合同文件上传请求已过期或不再有效。",
      });
    }

    const contract = assertEmployeeContractForProfile(
      contractSnapshot,
      input.employee_profile_id,
    );
    assertEmployeeContractWorkplace(contract, input.workplace_warehouse_id);
    const documents = documentSnapshots.docs
      .map(mapEmployeeContractDocumentSnapshot)
      .filter((document) => !document.is_deleted);
    const now = new Date();
    const version =
      documents.reduce(
        (maximum, document) => Math.max(maximum, document.version),
        0,
      ) + 1;
    const document: EmployeeContractDocument = {
      id: documentId,
      contract_id: contract.id,
      employee_profile_id: contract.employee_profile_id,
      employee_user_id: contract.employee_user_id,
      workplace_warehouse_id: contract.workplace_warehouse_id,
      storage_path: input.persisted.storage_path,
      storage_generation: input.persisted.storage_generation,
      upload_intent_id: intent.id,
      original_file_name: intent.original_file_name,
      mime_type: "application/pdf",
      file_size: input.persisted.file_size,
      sha256: input.persisted.sha256,
      version,
      is_current: true,
      uploaded_by: input.context.actor_id,
      updated_by: input.context.actor_id,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };

    for (const current of documents.filter((item) => item.is_current)) {
      const updated = {
        ...current,
        is_current: false,
        updated_by: input.context.actor_id,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      transaction.set(employeeContractDocumentRef(current.id), updated);
      writeEmployeeContractDocumentAudit(
        transaction,
        `${intent.id}:supersede:${current.id}`,
        AuditAction.UPDATE,
        input.context,
        EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION,
        current.id,
        current.workplace_warehouse_id,
        current.original_file_name,
        current,
        updated,
        now,
        "Employee contract document superseded",
      );
    }
    const finalizedIntent: EmployeeContractDocumentUploadIntent = {
      ...intent,
      status: EmployeeContractDocumentUploadIntentStatus.FINALIZED,
      finalized_document_id: document.id,
      finalized_at: now,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    transaction.create(employeeContractDocumentRef(document.id), document);
    transaction.set(intentRef, finalizedIntent);
    writeEmployeeContractDocumentVersionLock(
      transaction,
      versionLockSnapshot,
      document,
      input.context,
      now,
    );
    writeEmployeeContractDocumentAudit(
      transaction,
      `${intent.id}:document:create`,
      AuditAction.CREATE,
      input.context,
      EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION,
      document.id,
      document.workplace_warehouse_id,
      document.original_file_name,
      null,
      document,
      now,
      `Employee contract document version ${document.version} created`,
    );
    writeEmployeeContractDocumentAudit(
      transaction,
      `${intent.id}:finalize`,
      AuditAction.UPDATE,
      input.context,
      EMPLOYEE_CONTRACT_DOCUMENT_UPLOAD_INTENTS_COLLECTION,
      intent.id,
      intent.workplace_warehouse_id,
      intent.original_file_name,
      intent,
      finalizedIntent,
      now,
      "Employee contract document upload intent finalized",
    );
    return { document, replayed: false };
  });
};
