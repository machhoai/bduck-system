import {
  AuditAction,
  EmployeeContractImportBatchStatus,
  EmployeeContractImportRowStatus,
  type EmployeeContractDocument,
  type EmployeeContractImportRow,
  type EmployeeContractImportStagedDocument,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { randomUUID } from "node:crypto";

import { db } from "../config/firebase.js";
import {
  createEmployeeContractPolicyIssue,
  createEmployeeContractPolicyMessage,
  doEmployeeContractPeriodsOverlap,
  normalizeEmployeeContractNumber,
  validateEmployeeContractDraft,
} from "../services/employeeContractPolicy.js";
import { buildImportedEmployeeContract } from "../services/employeeContractImportContractFactory.js";
import {
  EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION,
  EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION,
  mapEmployeeContractImportBatch,
  mapEmployeeContractImportRow,
} from "./employeeContractImportRepository.js";
import {
  employeeContractNumberLockRef,
  employeeContractRef,
  writeEmployeeContractAudit,
  writeEmployeeContractNumberLock,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import { throwEmployeeContractPolicyIssues } from "./employeeContractRepositoryGuards.js";
import {
  loadEmployeeContractNumberInTransaction,
  loadEmployeeContractsInTransaction,
} from "./employeeContractQueryRepository.js";
import {
  EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION,
  employeeContractDocumentLockRef,
  employeeContractDocumentRef,
  writeEmployeeContractDocumentAudit,
  writeEmployeeContractDocumentVersionLock,
} from "./employeeContractDocumentRepository.js";

export interface EmployeeContractImportRowCommitResult {
  row: EmployeeContractImportRow;
  duplicate: boolean;
}

export const commitEmployeeContractImportRow = async (input: {
  batch_id: string;
  row_id: string;
  profile: EmployeeProfile;
  persisted_document: EmployeeContractImportStagedDocument | null;
  expected_batch_checksum: string;
  context: EmployeeContractOperationContext;
}): Promise<EmployeeContractImportRowCommitResult> => {
  const contractId = randomUUID();
  const documentId = input.persisted_document ? randomUUID() : null;
  return db.runTransaction(async (transaction) => {
    const batchRef = db
      .collection(EMPLOYEE_CONTRACT_IMPORT_BATCHES_COLLECTION)
      .doc(input.batch_id);
    const rowRef = db
      .collection(EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION)
      .doc(input.row_id);
    const [batchSnapshot, rowSnapshot] = await Promise.all([
      transaction.get(batchRef),
      transaction.get(rowRef),
    ]);
    if (!batchSnapshot.exists || !rowSnapshot.exists) {
      throw new Error("CONTRACT_IMPORT_ROW_NOT_FOUND");
    }
    const batch = mapEmployeeContractImportBatch(batchSnapshot);
    const currentRow = mapEmployeeContractImportRow(rowSnapshot);
    if (currentRow.status === EmployeeContractImportRowStatus.COMMITTED) {
      return { row: currentRow, duplicate: true };
    }
    if (
      batch.source_file_checksum !== input.expected_batch_checksum ||
      batch.status !== EmployeeContractImportBatchStatus.COMMITTING
    ) {
      throw {
        code: "CONTRACT_IMPORT_BATCH_CHANGED",
        statusCode: 409,
        messages: {
          vi: "Batch import đã thay đổi trạng thái hoặc checksum.",
          zh: "导入批次状态或校验和已更改。",
        },
      };
    }
    if (
      currentRow.status !== EmployeeContractImportRowStatus.VALID &&
      currentRow.status !== EmployeeContractImportRowStatus.FAILED
    ) {
      throw new Error("CONTRACT_IMPORT_ROW_INVALID");
    }
    if (
      currentRow.employee_profile_id !== input.profile.id ||
      currentRow.workplace_warehouse_id !==
        input.profile.workplace_warehouse_id ||
      !currentRow.normalized_payload.contract_type
    ) {
      throw new Error("CONTRACT_IMPORT_PROFILE_CHANGED");
    }
    const normalizedNumber = normalizeEmployeeContractNumber(
      currentRow.normalized_payload.contract_number,
    );
    const numberLockRef = employeeContractNumberLockRef(normalizedNumber);
    const documentLockRef = employeeContractDocumentLockRef(contractId);
    const [
      numberLockSnapshot,
      globalNumberContract,
      existingContracts,
      documentLockSnapshot,
    ] =
      await Promise.all([
        transaction.get(numberLockRef),
        loadEmployeeContractNumberInTransaction(transaction, normalizedNumber),
        loadEmployeeContractsInTransaction(transaction, input.profile.id),
        input.persisted_document
          ? transaction.get(documentLockRef)
          : Promise.resolve(null),
      ]);
    if (globalNumberContract) {
      throw {
        code: "CONTRACT_NUMBER_DUPLICATE",
        statusCode: 409,
        messages: {
          vi: "Số hợp đồng đã được sử dụng trong toàn công ty.",
          zh: "该合同编号已在公司范围内使用。",
        },
      };
    }
    const now = new Date();
    const contract = buildImportedEmployeeContract({
      id: contractId,
      payload: currentRow.normalized_payload,
      profile: input.profile,
      actor_id: input.context.actor_id,
      action_time: input.context.action_time,
      sync_time: now,
    });
    const policyIssues = validateEmployeeContractDraft(
        input.profile.id,
        {
          contract_number: currentRow.normalized_payload.contract_number,
          contract_type: currentRow.normalized_payload.contract_type,
          start_date: currentRow.normalized_payload.start_date,
          end_date: currentRow.normalized_payload.end_date,
        },
        existingContracts,
      ).filter((issue) => issue.code !== "CONTRACT_PERIOD_OVERLAP");
    const overlap = existingContracts.find((existing) =>
      doEmployeeContractPeriodsOverlap(contract, existing),
    );
    if (overlap) {
      policyIssues.push(
        createEmployeeContractPolicyIssue(
          "CONTRACT_PERIOD_OVERLAP",
          "start_date",
          createEmployeeContractPolicyMessage(
            "Nhân viên đã có hợp đồng trong khoảng thời gian này.",
            "该员工在此时间段内已有合同。",
          ),
          overlap.id,
        ),
      );
    }
    throwEmployeeContractPolicyIssues(policyIssues);
    transaction.create(employeeContractRef(contract.id), contract);
    writeEmployeeContractNumberLock(
      transaction,
      numberLockRef,
      numberLockSnapshot,
      contract,
      input.context,
      now,
    );
    writeEmployeeContractAudit(
      transaction,
      `contract-import:${currentRow.id}`,
      "create",
      AuditAction.CREATE,
      input.context,
      null,
      contract,
      now,
    );
    let document: EmployeeContractDocument | null = null;
    if (input.persisted_document && documentId && documentLockSnapshot) {
      document = {
        id: documentId,
        contract_id: contract.id,
        employee_profile_id: contract.employee_profile_id,
        employee_user_id: contract.employee_user_id,
        workplace_warehouse_id: contract.workplace_warehouse_id,
        storage_path: input.persisted_document.storage_path,
        storage_generation: input.persisted_document.storage_generation,
        upload_intent_id: `import:${input.batch_id}:${currentRow.id}`,
        original_file_name: input.persisted_document.original_file_name,
        mime_type: "application/pdf",
        file_size: input.persisted_document.file_size,
        sha256: input.persisted_document.sha256,
        version: 1,
        is_current: true,
        uploaded_by: input.context.actor_id,
        updated_by: input.context.actor_id,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      transaction.create(employeeContractDocumentRef(document.id), document);
      writeEmployeeContractDocumentVersionLock(
        transaction,
        documentLockSnapshot,
        document,
        input.context,
        now,
      );
      writeEmployeeContractDocumentAudit(
        transaction,
        `contract-import:${currentRow.id}:document`,
        AuditAction.CREATE,
        input.context,
        EMPLOYEE_CONTRACT_DOCUMENTS_COLLECTION,
        document.id,
        document.workplace_warehouse_id,
        document.original_file_name,
        null,
        document,
        now,
        "Employee contract import PDF created",
      );
    }
    const row: EmployeeContractImportRow = {
      ...currentRow,
      status: EmployeeContractImportRowStatus.COMMITTED,
      contract_id: contract.id,
      document_id: document?.id ?? null,
      error_code: null,
      committed_at: now,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    transaction.set(rowRef, row);
    transaction.create(
      db.collection("audit_logs").doc(
        `contract-import:${currentRow.id}:commit`,
      ),
      {
        id: `contract-import:${currentRow.id}:commit`,
        entity_type: EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION,
        entity_id: currentRow.id,
        warehouse_id: currentRow.workplace_warehouse_id,
        action: AuditAction.UPDATE,
        user_id: input.context.actor_id,
        user_name: null,
        entity_name: currentRow.source_reference,
        action_time: input.context.action_time,
        sync_time: now,
        old_value: currentRow,
        new_value: row,
        ip_address: input.context.ip_address ?? null,
        device_id: input.context.device_id ?? null,
        session_token: null,
        notes: "Employee contract import row committed",
      },
    );
    return { row, duplicate: false };
  });
};
