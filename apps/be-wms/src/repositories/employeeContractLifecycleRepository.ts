import {
  AuditAction,
  EmployeeContractStatus,
  type CancelEmployeeContractInput,
  type EmployeeContract,
  type EmployeeContractMutationResult,
  type TerminateEmployeeContractInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import {
  validateEmployeeContractCancellation,
  validateEmployeeContractTermination,
} from "../services/employeeContractLifecyclePolicy.js";
import { getVietnamLocalDate } from "../services/employeeEmploymentPolicy.js";

import {
  employeeContractNumberLockRef,
  employeeContractRef,
  prepareEmployeeContractOperation,
  writeEmployeeContractAudit,
  writeEmployeeContractNumberLock,
  writeEmployeeContractOperation,
  type EmployeeContractOperationAction,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import {
  assertEmployeeContractForProfile,
  assertEmployeeContractRevision,
  assertEmployeeContractWorkplace,
  throwEmployeeContractPolicyIssues,
} from "./employeeContractRepositoryGuards.js";

export type EmployeeContractLifecycleMutationInput = {
  employee_profile_id: string;
  workplace_warehouse_id: string;
  contract_id: string;
  request: CancelEmployeeContractInput | TerminateEmployeeContractInput;
  context: EmployeeContractOperationContext;
};

const applyLifecycleMutation = async (
  action: Extract<EmployeeContractOperationAction, "CANCEL" | "TERMINATE">,
  input: EmployeeContractLifecycleMutationInput,
): Promise<EmployeeContractMutationResult> =>
  db.runTransaction(async (transaction) => {
    const operation = await prepareEmployeeContractOperation(
      transaction,
      action,
      input.context,
      {
        employee_profile_id: input.employee_profile_id,
        workplace_warehouse_id: input.workplace_warehouse_id,
        contract_id: input.contract_id,
        request: input.request,
      },
    );
    if (operation.replay) return operation.replay;

    const contractRef = employeeContractRef(input.contract_id);
    const contractSnapshot = await transaction.get(contractRef);
    const previous = assertEmployeeContractForProfile(
      contractSnapshot,
      input.employee_profile_id,
    );
    assertEmployeeContractRevision(previous, input.request.expected_revision);
    assertEmployeeContractWorkplace(previous, input.workplace_warehouse_id);

    const lockRef = employeeContractNumberLockRef(
      previous.contract_number_normalized,
    );
    const lockSnapshot = await transaction.get(lockRef);
    const today = getVietnamLocalDate();
    const issues =
      action === "CANCEL"
        ? validateEmployeeContractCancellation(
            previous,
            input.request.reason,
            today,
          )
        : validateEmployeeContractTermination(
            previous,
            (input.request as TerminateEmployeeContractInput).termination_date,
            input.request.reason,
            today,
          );
    throwEmployeeContractPolicyIssues(issues);

    const now = new Date();
    const updated = lifecycleContract(
      previous,
      action,
      input.request,
      input.context,
      now,
    );
    const result = { contract: updated, source_contract: null };

    transaction.set(contractRef, updated);
    writeEmployeeContractNumberLock(
      transaction,
      lockRef,
      lockSnapshot,
      updated,
      input.context,
      now,
    );
    writeEmployeeContractAudit(
      transaction,
      operation.id,
      action.toLowerCase(),
      action === "CANCEL" ? AuditAction.CANCEL : AuditAction.UPDATE,
      input.context,
      previous,
      updated,
      now,
    );
    writeEmployeeContractOperation(
      transaction,
      operation,
      action,
      input.context,
      result,
      now,
    );
    return { ...result, replayed: false };
  });

const lifecycleContract = (
  previous: EmployeeContract,
  action: "CANCEL" | "TERMINATE",
  request: CancelEmployeeContractInput | TerminateEmployeeContractInput,
  context: EmployeeContractOperationContext,
  now: Date,
): EmployeeContract => ({
  ...previous,
  status:
    action === "CANCEL"
      ? EmployeeContractStatus.CANCELLED
      : EmployeeContractStatus.TERMINATED,
  cancellation_reason: action === "CANCEL" ? request.reason : null,
  cancelled_by: action === "CANCEL" ? context.actor_id : null,
  cancelled_at: action === "CANCEL" ? now : null,
  termination_date:
    action === "TERMINATE"
      ? (request as TerminateEmployeeContractInput).termination_date
      : null,
  termination_reason: action === "TERMINATE" ? request.reason : null,
  terminated_by: action === "TERMINATE" ? context.actor_id : null,
  terminated_at: action === "TERMINATE" ? now : null,
  revision: previous.revision + 1,
  updated_by: context.actor_id,
  updated_at: now,
  action_time: context.action_time,
  sync_time: now,
});

export const cancelEmployeeContractRecord = async (
  input: EmployeeContractLifecycleMutationInput,
): Promise<EmployeeContractMutationResult> =>
  applyLifecycleMutation("CANCEL", input);

export const terminateEmployeeContractRecord = async (
  input: EmployeeContractLifecycleMutationInput,
): Promise<EmployeeContractMutationResult> =>
  applyLifecycleMutation("TERMINATE", input);
