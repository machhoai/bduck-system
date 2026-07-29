import { createHash } from "node:crypto";

import {
  AuditAction,
  type EmployeeContract,
  type LocalDate,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import { resolveAutomatedEmployeeContractStatus } from "../services/employeeContractAutomationPolicy.js";
import { normalizeEmployeeContractNumber } from "../services/employeeContractPolicy.js";
import type { EmployeeContractNumberLockView } from "../services/employeeContractReconciliationPolicy.js";

import {
  EMPLOYEE_CONTRACTS_COLLECTION,
  employeeContractNumberLockRef,
  employeeContractRef,
  mapEmployeeContractSnapshot,
} from "./employeeContractRepository.js";

const LOCKS = "employee_contract_number_locks";
const AUDITS = "audit_logs";

export const findEmployeeContractRolloutState = async (): Promise<{
  contracts: EmployeeContract[];
  locks: EmployeeContractNumberLockView[];
}> => {
  const [contractSnapshot, lockSnapshot] = await Promise.all([
    db.collection(EMPLOYEE_CONTRACTS_COLLECTION).get(),
    db.collection(LOCKS).get(),
  ]);
  return {
    contracts: contractSnapshot.docs.map(mapEmployeeContractSnapshot),
    locks: lockSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      contract_number_normalized:
        snapshot.get("contract_number_normalized") ?? "",
      contract_id: snapshot.get("contract_id") ?? "",
      is_deleted: snapshot.get("is_deleted") === true,
    })),
  };
};

export const repairEmployeeContractRolloutProjection = async (input: {
  contract_id: string;
  as_of_date: LocalDate;
  actor_id: string;
}): Promise<"REPAIRED" | "UNCHANGED"> =>
  db.runTransaction(async (transaction) => {
    const contractRef = employeeContractRef(input.contract_id);
    const contractSnapshot = await transaction.get(contractRef);
    if (!contractSnapshot.exists) throw new Error("CONTRACT_NOT_FOUND");
    const previous = mapEmployeeContractSnapshot(contractSnapshot);
    const normalized = normalizeEmployeeContractNumber(
      previous.contract_number,
    );
    const lockRef = employeeContractNumberLockRef(normalized);
    const lockSnapshot = await transaction.get(lockRef);
    if (
      lockSnapshot.exists &&
      lockSnapshot.get("contract_id") !== previous.id
    ) {
      throw new Error("CONTRACT_NUMBER_LOCK_CONFLICT");
    }
    const expectedStatus = resolveAutomatedEmployeeContractStatus(
      previous,
      input.as_of_date,
    );
    const projectionChanged =
      previous.contract_number_normalized !== normalized ||
      previous.status !== expectedStatus;
    const lockChanged =
      !lockSnapshot.exists ||
      lockSnapshot.get("contract_id") !== previous.id ||
      lockSnapshot.get("is_deleted") === true;
    if (!projectionChanged && !lockChanged) return "UNCHANGED";

    const now = new Date();
    const updated: EmployeeContract = projectionChanged
      ? {
          ...previous,
          contract_number_normalized: normalized,
          status: expectedStatus,
          revision: previous.revision + 1,
          updated_by: input.actor_id,
          updated_at: now,
          action_time: now,
          sync_time: now,
        }
      : previous;
    if (projectionChanged) transaction.set(contractRef, updated);
    transaction.set(
      lockRef,
      {
        id: lockRef.id,
        contract_number_normalized: normalized,
        contract_id: previous.id,
        employee_profile_id: previous.employee_profile_id,
        workplace_warehouse_id: previous.workplace_warehouse_id,
        created_by: lockSnapshot.exists
          ? lockSnapshot.get("created_by")
          : input.actor_id,
        created_at: lockSnapshot.exists
          ? lockSnapshot.get("created_at")
          : now,
        last_contract_revision: updated.revision,
        updated_at: now,
        action_time: now,
        sync_time: now,
        is_deleted: false,
      },
      { merge: true },
    );
    const auditId = createHash("sha256")
      .update(`contract-rollout:${previous.id}:${updated.revision}:${lockChanged}`)
      .digest("hex");
    transaction.set(db.collection(AUDITS).doc(auditId), {
      id: auditId,
      entity_type: "employee_contracts",
      entity_id: previous.id,
      warehouse_id: previous.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: input.actor_id,
      user_name: "System",
      entity_name: previous.contract_number,
      action_time: now,
      sync_time: now,
      old_value: previous,
      new_value: updated,
      notes: "Employee contract rollout projection reconciliation",
    });
    return "REPAIRED";
  });
