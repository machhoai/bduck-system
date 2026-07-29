import {
  AuditAction,
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  EmployeeContractDocumentUploadIntentStatus,
  type EmployeeContractDocumentUploadIntent,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import {
  contractError,
  employeeContractRef,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import {
  assertEmployeeContractForProfile,
  assertEmployeeContractWorkplace,
} from "./employeeContractRepositoryGuards.js";
import {
  EMPLOYEE_CONTRACT_DOCUMENT_UPLOAD_INTENTS_COLLECTION,
  employeeContractDocumentIntentRef,
  hashEmployeeContractDocumentRequest,
  mapEmployeeContractDocumentIntentSnapshot,
  writeEmployeeContractDocumentAudit,
} from "./employeeContractDocumentRepository.js";

export const createEmployeeContractDocumentUploadIntentRecord = async (input: {
  employee_profile_id: string;
  workplace_warehouse_id: string;
  contract_id: string;
  original_file_name: string;
  intent_id: string;
  upload_storage_path: string;
  expires_at: Date;
  context: EmployeeContractOperationContext;
}): Promise<EmployeeContractDocumentUploadIntent> =>
  db.runTransaction(async (transaction) => {
    const intentRef = employeeContractDocumentIntentRef(input.intent_id);
    const contractRef = employeeContractRef(input.contract_id);
    const [intentSnapshot, contractSnapshot] = await Promise.all([
      transaction.get(intentRef),
      transaction.get(contractRef),
    ]);
    const requestHash = hashEmployeeContractDocumentRequest(input);
    if (intentSnapshot.exists) {
      const existing =
        mapEmployeeContractDocumentIntentSnapshot(intentSnapshot);
      if (
        existing.request_hash !== requestHash ||
        existing.created_by !== input.context.actor_id
      ) {
        throw contractError("CONTRACT_DOCUMENT_IDEMPOTENCY_CONFLICT", {
          vi: "Khóa chống trùng đã được dùng cho yêu cầu tải tệp khác.",
          zh: "幂等键已用于其他文件上传请求。",
        });
      }
      return existing;
    }

    const contract = assertEmployeeContractForProfile(
      contractSnapshot,
      input.employee_profile_id,
    );
    assertEmployeeContractWorkplace(contract, input.workplace_warehouse_id);
    const now = new Date();
    const intent: EmployeeContractDocumentUploadIntent = {
      id: input.intent_id,
      contract_id: contract.id,
      employee_profile_id: contract.employee_profile_id,
      employee_user_id: contract.employee_user_id,
      workplace_warehouse_id: contract.workplace_warehouse_id,
      original_file_name: input.original_file_name,
      upload_storage_path: input.upload_storage_path,
      expected_mime_type: "application/pdf",
      max_file_size: EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
      status: EmployeeContractDocumentUploadIntentStatus.PENDING,
      request_hash: requestHash,
      expires_at: input.expires_at,
      finalized_document_id: null,
      finalized_at: null,
      failure_code: null,
      created_by: input.context.actor_id,
      updated_by: input.context.actor_id,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    transaction.create(intentRef, intent);
    writeEmployeeContractDocumentAudit(
      transaction,
      `${intent.id}:create`,
      AuditAction.CREATE,
      input.context,
      EMPLOYEE_CONTRACT_DOCUMENT_UPLOAD_INTENTS_COLLECTION,
      intent.id,
      intent.workplace_warehouse_id,
      intent.original_file_name,
      null,
      intent,
      now,
      "Employee contract document upload intent created",
    );
    return intent;
  });
