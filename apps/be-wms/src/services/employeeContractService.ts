import type {
  CancelEmployeeContractInput,
  RenewEmployeeContractInput,
  TerminateEmployeeContractInput,
  UpdateEmployeeContractInput,
} from "@bduck/shared-types";

import {
  cancelEmployeeContractRecord,
  terminateEmployeeContractRecord,
} from "../repositories/employeeContractLifecycleRepository.js";
import {
  createEmployeeContractRecord,
  updateEmployeeContractRecord,
} from "../repositories/employeeContractMutationRepository.js";
import {
  findEmployeeContractById,
  findEmployeeContractsByProfileId,
} from "../repositories/employeeContractQueryRepository.js";
import { renewEmployeeContractRecord } from "../repositories/employeeContractRenewalRepository.js";
import {
  contractError,
  type EmployeeContractAuditMetadata,
  type EmployeeContractOperationContext,
} from "../repositories/employeeContractRepository.js";
import { getEmployeeProfileById } from "../repositories/employeeProfileRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import type {
  CancelEmployeeContractRequest,
  CreateEmployeeContractRequest,
  RenewEmployeeContractRequest,
  TerminateEmployeeContractRequest,
  UpdateEmployeeContractRequest,
} from "./employeeContractSchemas.js";

const profileNotFoundError = () =>
  contractError(
    "EMPLOYEE_PROFILE_NOT_FOUND",
    {
      vi: "Hồ sơ nhân viên không tồn tại hoặc đã bị xóa.",
      zh: "员工档案不存在或已被删除。",
    },
    404,
  );

const contractNotFoundError = () =>
  contractError(
    "CONTRACT_NOT_FOUND",
    {
      vi: "Không tìm thấy hợp đồng của nhân viên.",
      zh: "未找到该员工的合同。",
    },
    404,
  );

const createContext = (
  actorId: string,
  actionTime: Date,
  idempotencyKey: string,
  metadata?: EmployeeContractAuditMetadata,
): EmployeeContractOperationContext => ({
  actor_id: actorId,
  action_time: actionTime,
  idempotency_key: idempotencyKey,
  ...metadata,
});

const authorizeExistingContract = async (
  employeeProfileId: string,
  contractId: string,
  permission: string,
  authorization: AuthorizationService,
) => {
  const contract = await findEmployeeContractById(contractId);
  if (!contract || contract.employee_profile_id !== employeeProfileId) {
    throw contractNotFoundError();
  }
  authorization.assert(permission, contract.workplace_warehouse_id);
  return contract;
};

export const listEmployeeContracts = async (
  employeeProfileId: string,
  actorId: string,
  authorization: AuthorizationService,
) => {
  const profile = await getEmployeeProfileById(employeeProfileId);
  if (!profile) throw profileNotFoundError();
  const facilityId = profile.workplace_warehouse_id;
  const canReadAll = authorization.can(
    "employees.contracts.read",
    facilityId,
  );
  const canReadSelf =
    profile.user_id === actorId &&
    authorization.can("employees.contracts.self.read", facilityId);
  if (!canReadAll && !canReadSelf) {
    authorization.assert("employees.contracts.read", facilityId);
  }
  return findEmployeeContractsByProfileId(employeeProfileId);
};

export const createEmployeeContract = async (
  employeeProfileId: string,
  input: CreateEmployeeContractRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) => {
  const profile = await getEmployeeProfileById(employeeProfileId);
  if (!profile) throw profileNotFoundError();
  authorization.assert(
    "employees.contracts.manage",
    profile.workplace_warehouse_id,
  );
  return createEmployeeContractRecord({
    employee_profile_id: employeeProfileId,
    workplace_warehouse_id: profile.workplace_warehouse_id,
    contract: input,
    context: createContext(
      actorId,
      input.action_time,
      input.idempotency_key,
      metadata,
    ),
  });
};

export const updateEmployeeContract = async (
  employeeProfileId: string,
  contractId: string,
  input: UpdateEmployeeContractRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) => {
  const contract = await authorizeExistingContract(
    employeeProfileId,
    contractId,
    "employees.contracts.manage",
    authorization,
  );
  return updateEmployeeContractRecord({
    employee_profile_id: employeeProfileId,
    workplace_warehouse_id: contract.workplace_warehouse_id,
    contract_id: contractId,
    patch: input as UpdateEmployeeContractInput,
    context: createContext(
      actorId,
      input.action_time,
      input.idempotency_key,
      metadata,
    ),
  });
};

export const renewEmployeeContract = async (
  employeeProfileId: string,
  contractId: string,
  input: RenewEmployeeContractRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) => {
  const contract = await authorizeExistingContract(
    employeeProfileId,
    contractId,
    "employees.contracts.manage",
    authorization,
  );
  return renewEmployeeContractRecord({
    employee_profile_id: employeeProfileId,
    workplace_warehouse_id: contract.workplace_warehouse_id,
    source_contract_id: contractId,
    contract: input as RenewEmployeeContractInput,
    context: createContext(
      actorId,
      input.action_time,
      input.idempotency_key,
      metadata,
    ),
  });
};

const mutateLifecycle = async (
  action: "cancel" | "terminate",
  employeeProfileId: string,
  contractId: string,
  input: CancelEmployeeContractRequest | TerminateEmployeeContractRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) => {
  const contract = await authorizeExistingContract(
    employeeProfileId,
    contractId,
    "employees.contracts.terminate",
    authorization,
  );
  const request = input as
    | CancelEmployeeContractInput
    | TerminateEmployeeContractInput;
  const payload = {
    employee_profile_id: employeeProfileId,
    workplace_warehouse_id: contract.workplace_warehouse_id,
    contract_id: contractId,
    request,
    context: createContext(
      actorId,
      input.action_time,
      input.idempotency_key,
      metadata,
    ),
  };
  return action === "cancel"
    ? cancelEmployeeContractRecord(payload)
    : terminateEmployeeContractRecord(payload);
};

export const cancelEmployeeContract = (
  employeeProfileId: string,
  contractId: string,
  input: CancelEmployeeContractRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) =>
  mutateLifecycle(
    "cancel",
    employeeProfileId,
    contractId,
    input,
    actorId,
    authorization,
    metadata,
  );

export const terminateEmployeeContract = (
  employeeProfileId: string,
  contractId: string,
  input: TerminateEmployeeContractRequest,
  actorId: string,
  authorization: AuthorizationService,
  metadata?: EmployeeContractAuditMetadata,
) =>
  mutateLifecycle(
    "terminate",
    employeeProfileId,
    contractId,
    input,
    actorId,
    authorization,
    metadata,
  );
