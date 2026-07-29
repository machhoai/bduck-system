import { createHash } from "node:crypto";

import {
  EmployeeContractDocumentUploadIntentStatus,
  type EmployeeContract,
} from "@bduck/shared-types";

import { createEmployeeContractDocumentUploadIntentRecord } from "../repositories/employeeContractDocumentIntentRepository.js";
import { finalizeEmployeeContractDocumentRecord } from "../repositories/employeeContractDocumentMutationRepository.js";
import {
  findEmployeeContractDocumentById,
  findEmployeeContractDocumentIntentById,
  findEmployeeContractDocuments,
} from "../repositories/employeeContractDocumentRepository.js";
import { findEmployeeContractById } from "../repositories/employeeContractQueryRepository.js";
import {
  contractError,
  type EmployeeContractAuditMetadata,
  type EmployeeContractOperationContext,
} from "../repositories/employeeContractRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import { canReadEmployeeContractDocument } from "./employeeContractDocumentAccessPolicy.js";
import type {
  CreateEmployeeContractUploadIntentRequest,
  FinalizeEmployeeContractUploadRequest,
} from "./employeeContractDocumentSchemas.js";
import {
  buildEmployeeContractUploadStoragePath,
  createEmployeeContractSignedDownload,
  createEmployeeContractSignedUpload,
  EMPLOYEE_CONTRACT_UPLOAD_TTL_MS,
  verifyAndPersistEmployeeContractPdf,
} from "./employeeContractDocumentStorageService.js";

const documentError = (
  code: string,
  vi: string,
  zh: string,
  statusCode = 409,
) => contractError(code, { vi, zh }, statusCode);

const loadContract = async (
  employeeProfileId: string,
  contractId: string,
): Promise<EmployeeContract> => {
  const contract = await findEmployeeContractById(contractId);
  if (!contract || contract.employee_profile_id !== employeeProfileId) {
    throw documentError(
      "CONTRACT_NOT_FOUND",
      "Không tìm thấy hợp đồng của nhân viên.",
      "未找到该员工的合同。",
      404,
    );
  }
  return contract;
};

const operationContext = (
  actorId: string,
  input: { action_time: Date; idempotency_key: string },
  metadata?: EmployeeContractAuditMetadata,
): EmployeeContractOperationContext => ({
  actor_id: actorId,
  action_time: input.action_time,
  idempotency_key: input.idempotency_key,
  ...metadata,
});

const assertCanReadDocument = (
  contract: EmployeeContract,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const facilityId = contract.workplace_warehouse_id;
  if (canReadEmployeeContractDocument(contract, actorId, authorization)) {
    return;
  }
  authorization.assert("employees.contracts.documents.read", facilityId);
};

export const createEmployeeContractDocumentUploadIntent = async (
  employeeProfileId: string,
  contractId: string,
  input: CreateEmployeeContractUploadIntentRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) => {
  const contract = await loadContract(employeeProfileId, contractId);
  authorization.assert(
    "employees.contracts.documents.manage",
    contract.workplace_warehouse_id,
  );
  const intentId = createHash("sha256")
    .update(`${actorId}:CONTRACT_DOCUMENT_UPLOAD:${input.idempotency_key}`)
    .digest("hex");
  const intent = await createEmployeeContractDocumentUploadIntentRecord({
    employee_profile_id: employeeProfileId,
    workplace_warehouse_id: contract.workplace_warehouse_id,
    contract_id: contractId,
    original_file_name: input.original_file_name,
    intent_id: intentId,
    upload_storage_path: buildEmployeeContractUploadStoragePath(
      intentId,
      employeeProfileId,
      contractId,
      input.original_file_name,
    ),
    expires_at: new Date(Date.now() + EMPLOYEE_CONTRACT_UPLOAD_TTL_MS),
    context: operationContext(actorId, input, metadata),
  });
  if (
    intent.status !== EmployeeContractDocumentUploadIntentStatus.PENDING ||
    intent.expires_at.getTime() <= Date.now()
  ) {
    throw documentError(
      "CONTRACT_DOCUMENT_INTENT_EXPIRED",
      "Yêu cầu tải tệp đã hết hạn hoặc đã hoàn tất. Vui lòng tạo yêu cầu mới.",
      "文件上传请求已过期或已完成，请创建新请求。",
    );
  }
  return createEmployeeContractSignedUpload(intent);
};

export const finalizeEmployeeContractDocumentUpload = async (
  employeeProfileId: string,
  contractId: string,
  intentId: string,
  input: FinalizeEmployeeContractUploadRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) => {
  const contract = await loadContract(employeeProfileId, contractId);
  authorization.assert(
    "employees.contracts.documents.manage",
    contract.workplace_warehouse_id,
  );
  const intent = await findEmployeeContractDocumentIntentById(intentId);
  if (
    !intent ||
    intent.employee_profile_id !== employeeProfileId ||
    intent.contract_id !== contractId ||
    intent.created_by !== actorId
  ) {
    throw documentError(
      "CONTRACT_DOCUMENT_INTENT_NOT_FOUND",
      "Không tìm thấy yêu cầu tải tệp hợp đồng.",
      "未找到合同文件上传请求。",
      404,
    );
  }
  if (intent.finalized_document_id) {
    const document = await findEmployeeContractDocumentById(
      intent.finalized_document_id,
    );
    if (!document) {
      throw documentError(
        "CONTRACT_DOCUMENT_FINALIZE_CORRUPTED",
        "Không thể đọc kết quả hoàn tất tệp hợp đồng trước đó.",
        "无法读取先前的合同文件完成结果。",
        500,
      );
    }
    return { document, replayed: true };
  }
  if (
    intent.status !== EmployeeContractDocumentUploadIntentStatus.PENDING ||
    intent.expires_at.getTime() <= Date.now()
  ) {
    throw documentError(
      "CONTRACT_DOCUMENT_INTENT_EXPIRED",
      "Yêu cầu tải tệp hợp đồng đã hết hạn hoặc không còn hiệu lực.",
      "合同文件上传请求已过期或不再有效。",
    );
  }
  const persisted = await verifyAndPersistEmployeeContractPdf(intent);
  return finalizeEmployeeContractDocumentRecord({
    employee_profile_id: employeeProfileId,
    workplace_warehouse_id: contract.workplace_warehouse_id,
    contract_id: contractId,
    intent_id: intentId,
    persisted,
    context: operationContext(actorId, input, metadata),
  });
};

export const listEmployeeContractDocuments = async (
  employeeProfileId: string,
  contractId: string,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const contract = await loadContract(employeeProfileId, contractId);
  assertCanReadDocument(contract, actorId, authorization);
  return findEmployeeContractDocuments(contractId);
};

export const getEmployeeContractDocumentDownload = async (
  employeeProfileId: string,
  contractId: string,
  documentId: string,
  actorId: string,
  authorization: AuthorizationService,
  mode: "view" | "download" = "view",
) => {
  const contract = await loadContract(employeeProfileId, contractId);
  assertCanReadDocument(contract, actorId, authorization);
  const document = await findEmployeeContractDocumentById(documentId);
  if (
    !document ||
    document.contract_id !== contractId ||
    document.employee_profile_id !== employeeProfileId
  ) {
    throw documentError(
      "CONTRACT_DOCUMENT_NOT_FOUND",
      "Không tìm thấy tệp hợp đồng.",
      "未找到合同文件。",
      404,
    );
  }
  return createEmployeeContractSignedDownload(document, mode);
};
