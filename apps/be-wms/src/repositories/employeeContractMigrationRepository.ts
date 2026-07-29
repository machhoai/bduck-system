import {
  AuditAction,
  type EmployeeContractImportNormalizedPayload,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";
import { db } from "../config/firebase.js";
import { buildImportedEmployeeContract } from "../services/employeeContractImportContractFactory.js";
import {
  doEmployeeContractPeriodsOverlap,
  normalizeEmployeeContractNumber,
  validateEmployeeContractDraft,
} from "../services/employeeContractPolicy.js";
import {
  EMPLOYEE_PROFILES_COLLECTION,
  employeeContractNumberLockRef,
  employeeContractRef,
  writeEmployeeContractAudit,
  writeEmployeeContractNumberLock,
  type EmployeeContractOperationContext,
} from "./employeeContractRepository.js";
import { throwEmployeeContractPolicyIssues } from "./employeeContractRepositoryGuards.js";
import { loadEmployeeContractsInTransaction } from "./employeeContractQueryRepository.js";

const OPERATIONS = "employee_contract_migration_operations";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const importLegacyEmployeeContractRecord = async (input: {
  source_checksum: string;
  row_number: number;
  payload: EmployeeContractImportNormalizedPayload;
  profile: EmployeeProfile;
  context: EmployeeContractOperationContext;
}): Promise<{ contract_id: string; replayed: boolean }> => {
  const operationId = hash(
    `legacy-contract:${input.source_checksum}:${input.row_number}`,
  );
  const contractId = operationId;
  const normalized = normalizeEmployeeContractNumber(
    input.payload.contract_number,
  );
  return db.runTransaction(async (transaction) => {
    const operationRef = db.collection(OPERATIONS).doc(operationId);
    const contractRef = employeeContractRef(contractId);
    const profileRef = db
      .collection(EMPLOYEE_PROFILES_COLLECTION)
      .doc(input.profile.id);
    const lockRef = employeeContractNumberLockRef(normalized);
    const [operation, existingContract, profileSnapshot, lock, contracts] =
      await Promise.all([
        transaction.get(operationRef),
        transaction.get(contractRef),
        transaction.get(profileRef),
        transaction.get(lockRef),
        loadEmployeeContractsInTransaction(transaction, input.profile.id),
      ]);
    if (operation.exists && existingContract.exists) {
      return { contract_id: contractId, replayed: true };
    }
    if (
      !profileSnapshot.exists ||
      profileSnapshot.get("is_deleted") === true ||
      profileSnapshot.get("workplace_warehouse_id") !==
        input.profile.workplace_warehouse_id
    ) {
      throw new Error("EMPLOYEE_PROFILE_CHANGED");
    }
    if (lock.exists && lock.get("contract_id") !== contractId) {
      throw new Error("CONTRACT_NUMBER_DUPLICATE");
    }
    const now = new Date();
    const contract = buildImportedEmployeeContract({
      id: contractId,
      payload: input.payload,
      profile: input.profile,
      actor_id: input.context.actor_id,
      action_time: input.context.action_time,
      sync_time: now,
    });
    const issues = validateEmployeeContractDraft(
      input.profile.id,
      {
        contract_number: input.payload.contract_number,
        contract_type: input.payload.contract_type!,
        start_date: input.payload.start_date,
        end_date: input.payload.end_date,
      },
      contracts,
    ).filter((issue) => issue.code !== "CONTRACT_PERIOD_OVERLAP");
    const overlap = contracts.find((existing) =>
      doEmployeeContractPeriodsOverlap(contract, existing),
    );
    if (overlap) {
      issues.push({
        code: "CONTRACT_PERIOD_OVERLAP",
        field: "start_date",
        conflicting_contract_id: overlap.id,
        messages: {
          vi: "Nhân viên đã có hợp đồng trong khoảng thời gian này.",
          zh: "该员工在此时间段内已有合同。",
        },
      });
    }
    throwEmployeeContractPolicyIssues(issues);

    transaction.create(contractRef, contract);
    writeEmployeeContractNumberLock(
      transaction,
      lockRef,
      lock,
      contract,
      input.context,
      now,
    );
    writeEmployeeContractAudit(
      transaction,
      operationId,
      "legacy-import",
      AuditAction.CREATE,
      input.context,
      null,
      contract,
      now,
    );
    transaction.create(operationRef, {
      id: operationId,
      source_checksum: input.source_checksum,
      row_number: input.row_number,
      contract_id: contract.id,
      employee_profile_id: input.profile.id,
      action_time: input.context.action_time,
      sync_time: now,
      created_at: now,
      is_deleted: false,
    });
    return { contract_id: contractId, replayed: false };
  });
};
