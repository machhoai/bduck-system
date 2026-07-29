import {
  AuditAction,
  EmployeeContractStatus,
  type EmployeeContract,
  type EmployeeContractMutationResult,
  type RenewEmployeeContractInput,
} from "@bduck/shared-types";
import { randomUUID } from "node:crypto";

import { db } from "../config/firebase.js";
import { validateEmployeeContractRenewal } from "../services/employeeContractLifecyclePolicy.js";
import {
  normalizeEmployeeContractNumber,
  resolveEmployeeContractStatus,
} from "../services/employeeContractPolicy.js";
import { getVietnamLocalDate } from "../services/employeeEmploymentPolicy.js";
import {
  employeeContractNumberLockRef,
  employeeContractRef,
  prepareEmployeeContractOperation,
  writeEmployeeContractAudit,
  writeEmployeeContractNumberLock,
  writeEmployeeContractOperation,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import {
  assertEmployeeContractForProfile,
  assertEmployeeContractRevision,
  assertEmployeeContractWorkplace,
  throwEmployeeContractPolicyIssues,
} from "./employeeContractRepositoryGuards.js";
import { loadEmployeeContractsInTransaction } from "./employeeContractQueryRepository.js";

export const renewEmployeeContractRecord = async (input: {
  employee_profile_id: string;
  workplace_warehouse_id: string;
  source_contract_id: string;
  contract: RenewEmployeeContractInput;
  context: EmployeeContractOperationContext;
}): Promise<EmployeeContractMutationResult> => {
  const renewedContractId = randomUUID();
  const normalizedNumber = normalizeEmployeeContractNumber(
    input.contract.contract_number,
  );

  return db.runTransaction(async (transaction) => {
    const operation = await prepareEmployeeContractOperation(
      transaction,
      "RENEW",
      input.context,
      {
        employee_profile_id: input.employee_profile_id,
        workplace_warehouse_id: input.workplace_warehouse_id,
        source_contract_id: input.source_contract_id,
        contract: input.contract,
      },
    );
    if (operation.replay) return operation.replay;

    const sourceRef = employeeContractRef(input.source_contract_id);
    const sourceSnapshot = await transaction.get(sourceRef);
    const source = assertEmployeeContractForProfile(
      sourceSnapshot,
      input.employee_profile_id,
    );
    assertEmployeeContractRevision(source, input.contract.expected_revision);
    assertEmployeeContractWorkplace(source, input.workplace_warehouse_id);

    const newLockRef = employeeContractNumberLockRef(normalizedNumber);
    const sourceLockRef = employeeContractNumberLockRef(
      source.contract_number_normalized,
    );
    const [newLockSnapshot, sourceLockSnapshot, existingContracts] =
      await Promise.all([
        transaction.get(newLockRef),
        transaction.get(sourceLockRef),
        loadEmployeeContractsInTransaction(
          transaction,
          input.employee_profile_id,
        ),
      ]);
    throwEmployeeContractPolicyIssues(
      validateEmployeeContractRenewal(
        source,
        input.contract,
        existingContracts,
      ),
    );

    const now = new Date();
    const sourceUpdated: EmployeeContract = {
      ...source,
      revision: source.revision + 1,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const renewedBase: EmployeeContract = {
      id: renewedContractId,
      employee_profile_id: source.employee_profile_id,
      employee_user_id: source.employee_user_id,
      workplace_warehouse_id: source.workplace_warehouse_id,
      contract_number: input.contract.contract_number,
      contract_number_normalized: normalizedNumber,
      contract_type: input.contract.contract_type,
      start_date: input.contract.start_date,
      end_date: input.contract.end_date,
      status: EmployeeContractStatus.UPCOMING,
      renewed_from_contract_id: source.id,
      root_contract_id: source.root_contract_id,
      renewal_sequence: source.renewal_sequence + 1,
      termination_date: null,
      termination_reason: null,
      terminated_by: null,
      terminated_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      notes: input.contract.notes?.trim() || null,
      revision: 1,
      created_by: input.context.actor_id,
      updated_by: input.context.actor_id,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const renewed: EmployeeContract = {
      ...renewedBase,
      status: resolveEmployeeContractStatus(
        renewedBase,
        getVietnamLocalDate(now),
      ),
    };
    const result = {
      contract: renewed,
      source_contract: sourceUpdated,
    };

    transaction.set(sourceRef, sourceUpdated);
    transaction.create(employeeContractRef(renewed.id), renewed);
    writeEmployeeContractNumberLock(
      transaction,
      sourceLockRef,
      sourceLockSnapshot,
      sourceUpdated,
      input.context,
      now,
    );
    writeEmployeeContractNumberLock(
      transaction,
      newLockRef,
      newLockSnapshot,
      renewed,
      input.context,
      now,
    );
    writeEmployeeContractAudit(
      transaction,
      operation.id,
      "renew-source",
      AuditAction.UPDATE,
      input.context,
      source,
      sourceUpdated,
      now,
    );
    writeEmployeeContractAudit(
      transaction,
      operation.id,
      "renew-create",
      AuditAction.CREATE,
      input.context,
      null,
      renewed,
      now,
    );
    writeEmployeeContractOperation(
      transaction,
      operation,
      "RENEW",
      input.context,
      result,
      now,
    );
    return { ...result, replayed: false };
  });
};
