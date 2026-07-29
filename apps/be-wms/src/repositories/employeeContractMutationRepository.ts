import { randomUUID } from "node:crypto";

import {
  AuditAction,
  EmployeeContractStatus,
  type CreateEmployeeContractInput,
  type EmployeeContract,
  type EmployeeContractMutationResult,
  type UpdateEmployeeContractInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import {
  normalizeEmployeeContractNumber,
  resolveEmployeeContractStatus,
  validateEmployeeContractDraft,
} from "../services/employeeContractPolicy.js";
import { getVietnamLocalDate } from "../services/employeeEmploymentPolicy.js";

import { loadEmployeeContractsInTransaction } from "./employeeContractQueryRepository.js";
import {
  EMPLOYEE_PROFILES_COLLECTION,
  contractError,
  employeeContractNumberLockRef,
  employeeContractRef,
  mapEmployeeContractSnapshot,
  prepareEmployeeContractOperation,
  writeEmployeeContractAudit,
  writeEmployeeContractNumberLock,
  writeEmployeeContractOperation,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import {
  assertEmployeeContractRevision,
  assertEmployeeContractWorkplace,
  assertEmployeeProfileSnapshot,
  throwEmployeeContractPolicyIssues,
} from "./employeeContractRepositoryGuards.js";

export const createEmployeeContractRecord = async (input: {
  employee_profile_id: string;
  workplace_warehouse_id: string;
  contract: CreateEmployeeContractInput;
  context: EmployeeContractOperationContext;
}): Promise<EmployeeContractMutationResult> => {
  const contractId = randomUUID();
  const normalizedNumber = normalizeEmployeeContractNumber(
    input.contract.contract_number,
  );

  return db.runTransaction(async (transaction) => {
    const operation = await prepareEmployeeContractOperation(
      transaction,
      "CREATE",
      input.context,
      {
        employee_profile_id: input.employee_profile_id,
        workplace_warehouse_id: input.workplace_warehouse_id,
        contract: input.contract,
      },
    );
    if (operation.replay) return operation.replay;

    const profileRef = db
      .collection(EMPLOYEE_PROFILES_COLLECTION)
      .doc(input.employee_profile_id);
    const lockRef = employeeContractNumberLockRef(normalizedNumber);
    const [profileSnapshot, lockSnapshot, existingContracts] =
      await Promise.all([
        transaction.get(profileRef),
        transaction.get(lockRef),
        loadEmployeeContractsInTransaction(
          transaction,
          input.employee_profile_id,
        ),
      ]);
    const profile = assertEmployeeProfileSnapshot(profileSnapshot);
    if (profile.workplace_warehouse_id !== input.workplace_warehouse_id) {
      throw contractError("CONTRACT_PROFILE_SCOPE_CHANGED", {
        vi: "Nơi làm việc của nhân viên đã thay đổi. Vui lòng thực hiện lại yêu cầu.",
        zh: "员工工作地点已更改，请重新执行请求。",
      });
    }
    throwEmployeeContractPolicyIssues(
      validateEmployeeContractDraft(
        profile.id,
        input.contract,
        existingContracts,
      ),
    );

    const now = new Date();
    const baseContract: EmployeeContract = {
      id: contractId,
      employee_profile_id: profile.id,
      employee_user_id: profile.user_id,
      workplace_warehouse_id: profile.workplace_warehouse_id,
      contract_number: input.contract.contract_number,
      contract_number_normalized: normalizedNumber,
      contract_type: input.contract.contract_type,
      start_date: input.contract.start_date,
      end_date: input.contract.end_date,
      status: EmployeeContractStatus.UPCOMING,
      renewed_from_contract_id: null,
      root_contract_id: contractId,
      renewal_sequence: 0,
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
    const contract: EmployeeContract = {
      ...baseContract,
      status: resolveEmployeeContractStatus(
        baseContract,
        getVietnamLocalDate(now),
      ),
    };
    const result = { contract, source_contract: null };

    transaction.create(employeeContractRef(contract.id), contract);
    writeEmployeeContractNumberLock(
      transaction,
      lockRef,
      lockSnapshot,
      contract,
      input.context,
      now,
    );
    writeEmployeeContractAudit(
      transaction,
      operation.id,
      "create",
      AuditAction.CREATE,
      input.context,
      null,
      contract,
      now,
    );
    writeEmployeeContractOperation(
      transaction,
      operation,
      "CREATE",
      input.context,
      result,
      now,
    );
    return { ...result, replayed: false };
  });
};

export const updateEmployeeContractRecord = async (input: {
  employee_profile_id: string;
  workplace_warehouse_id: string;
  contract_id: string;
  patch: UpdateEmployeeContractInput;
  context: EmployeeContractOperationContext;
}): Promise<EmployeeContractMutationResult> =>
  db.runTransaction(async (transaction) => {
    const operation = await prepareEmployeeContractOperation(
      transaction,
      "UPDATE",
      input.context,
      {
        employee_profile_id: input.employee_profile_id,
        workplace_warehouse_id: input.workplace_warehouse_id,
        contract_id: input.contract_id,
        patch: input.patch,
      },
    );
    if (operation.replay) return operation.replay;

    const contractRef = employeeContractRef(input.contract_id);
    const contractSnapshot = await transaction.get(contractRef);
    if (
      !contractSnapshot.exists ||
      contractSnapshot.get("is_deleted") === true
    ) {
      throw contractError(
        "CONTRACT_NOT_FOUND",
        { vi: "Không tìm thấy hợp đồng.", zh: "未找到合同。" },
        404,
      );
    }
    const previous = mapEmployeeContractSnapshot(contractSnapshot);
    if (previous.employee_profile_id !== input.employee_profile_id) {
      throw contractError(
        "CONTRACT_NOT_FOUND",
        {
          vi: "Không tìm thấy hợp đồng của nhân viên.",
          zh: "未找到该员工的合同。",
        },
        404,
      );
    }
    assertEmployeeContractRevision(previous, input.patch.expected_revision);
    assertEmployeeContractWorkplace(previous, input.workplace_warehouse_id);
    if (
      previous.status === EmployeeContractStatus.CANCELLED ||
      previous.status === EmployeeContractStatus.TERMINATED
    ) {
      throw contractError("CONTRACT_UPDATE_NOT_ALLOWED", {
        vi: "Không thể sửa hợp đồng đã hủy hoặc chấm dứt.",
        zh: "无法修改已取消或已终止的合同。",
      });
    }

    const normalizedNumber =
      input.patch.contract_number === undefined
        ? previous.contract_number_normalized
        : normalizeEmployeeContractNumber(input.patch.contract_number);
    const lockRef = employeeContractNumberLockRef(normalizedNumber);
    const [lockSnapshot, existingContracts] = await Promise.all([
      transaction.get(lockRef),
      loadEmployeeContractsInTransaction(
        transaction,
        input.employee_profile_id,
      ),
    ]);
    const draft = {
      contract_number: input.patch.contract_number ?? previous.contract_number,
      contract_type: input.patch.contract_type ?? previous.contract_type,
      start_date: input.patch.start_date ?? previous.start_date,
      end_date:
        input.patch.end_date === undefined
          ? previous.end_date
          : input.patch.end_date,
    };
    throwEmployeeContractPolicyIssues(
      validateEmployeeContractDraft(
        input.employee_profile_id,
        draft,
        existingContracts,
        previous.id,
      ),
    );

    const now = new Date();
    const updatedBase: EmployeeContract = {
      ...previous,
      ...draft,
      contract_number_normalized: normalizedNumber,
      notes:
        input.patch.notes === undefined
          ? previous.notes
          : input.patch.notes?.trim() || null,
      revision: previous.revision + 1,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const updated: EmployeeContract = {
      ...updatedBase,
      status: resolveEmployeeContractStatus(
        updatedBase,
        getVietnamLocalDate(now),
      ),
    };
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
      "update",
      AuditAction.UPDATE,
      input.context,
      previous,
      updated,
      now,
    );
    writeEmployeeContractOperation(
      transaction,
      operation,
      "UPDATE",
      input.context,
      result,
      now,
    );
    return { ...result, replayed: false };
  });
