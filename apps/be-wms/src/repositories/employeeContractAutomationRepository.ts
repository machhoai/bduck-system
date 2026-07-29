import { createHash } from "node:crypto";

import {
  AuditAction,
  EmployeeContractAutomationRunStatus,
  type EmployeeContract,
  type EmployeeContractAutomationResult,
  type EmployeeContractAutomationRun,
  type LocalDate,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import {
  resolveAutomatedEmployeeContractStatus,
} from "../services/employeeContractAutomationPolicy.js";

import {
  employeeContractRef,
  mapEmployeeContractSnapshot,
} from "./employeeContractRepository.js";

const RUNS = "employee_contract_automation_runs";
const STATUS_OPERATIONS = "employee_contract_status_operations";
const AUDITS = "audit_logs";
const LEASE_MS = 15 * 60 * 1000;

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const runId = (asOfDate: LocalDate) =>
  hash(`employee-contract:daily-maintenance:${asOfDate}`);

export const claimEmployeeContractAutomationRun = async (
  asOfDate: LocalDate,
): Promise<{
  runId: string;
  claimed: boolean;
  result: EmployeeContractAutomationResult | null;
}> =>
  db.runTransaction(async (transaction) => {
    const id = runId(asOfDate);
    const ref = db.collection(RUNS).doc(id);
    const snapshot = await transaction.get(ref);
    const now = new Date();
    if (
      snapshot.exists &&
      snapshot.get("status") === EmployeeContractAutomationRunStatus.COMPLETED
    ) {
      return {
        runId: id,
        claimed: false,
        result: snapshot.get("result") as EmployeeContractAutomationResult,
      };
    }
    const lease = snapshot.get("lease_expires_at");
    const leaseDate = lease?.toDate?.() ?? lease;
    if (
      snapshot.exists &&
      snapshot.get("status") === EmployeeContractAutomationRunStatus.RUNNING &&
      leaseDate instanceof Date &&
      leaseDate > now
    ) {
      return { runId: id, claimed: false, result: null };
    }
    const run: EmployeeContractAutomationRun = {
      id,
      job_type: "DAILY_MAINTENANCE",
      as_of_date: asOfDate,
      status: EmployeeContractAutomationRunStatus.RUNNING,
      attempt: (snapshot.get("attempt") ?? 0) + 1,
      lease_expires_at: new Date(now.getTime() + LEASE_MS),
      completed_at: null,
      failed_at: null,
      error_message: null,
      result: null,
      is_deleted: false,
      created_at: snapshot.exists ? snapshot.get("created_at") : now,
      updated_at: now,
      action_time: now,
      sync_time: now,
    };
    transaction.set(ref, run);
    return { runId: id, claimed: true, result: null };
  });

export const completeEmployeeContractAutomationRun = async (
  id: string,
  result: EmployeeContractAutomationResult,
) => {
  const now = new Date();
  await db.collection(RUNS).doc(id).update({
    status: EmployeeContractAutomationRunStatus.COMPLETED,
    result,
    completed_at: now,
    error_message: null,
    updated_at: now,
    sync_time: now,
  });
};

export const failEmployeeContractAutomationRun = async (
  id: string,
  errorMessage: string,
) => {
  const now = new Date();
  await db.collection(RUNS).doc(id).update({
    status: EmployeeContractAutomationRunStatus.FAILED,
    failed_at: now,
    error_message: errorMessage.slice(0, 500),
    updated_at: now,
    sync_time: now,
  });
};

export const synchronizeEmployeeContractStatus = async (
  contractId: string,
  asOfDate: LocalDate,
  actorId: string,
): Promise<"UPDATED" | "SKIPPED" | "REPLAYED"> =>
  db.runTransaction(async (transaction) => {
    const operationId = hash(`status:${contractId}:${asOfDate}`);
    const operationRef = db.collection(STATUS_OPERATIONS).doc(operationId);
    const contractRef = employeeContractRef(contractId);
    const [operationSnapshot, contractSnapshot] = await Promise.all([
      transaction.get(operationRef),
      transaction.get(contractRef),
    ]);
    if (operationSnapshot.exists) {
      return "REPLAYED";
    }
    if (!contractSnapshot.exists || contractSnapshot.get("is_deleted")) {
      transaction.create(operationRef, {
        id: operationId,
        contract_id: contractId,
        as_of_date: asOfDate,
        updated: false,
        created_at: new Date(),
      });
      return "SKIPPED";
    }
    const previous = mapEmployeeContractSnapshot(contractSnapshot);
    const status = resolveAutomatedEmployeeContractStatus(previous, asOfDate);
    const now = new Date();
    if (status === previous.status) {
      transaction.create(operationRef, {
        id: operationId,
        contract_id: contractId,
        as_of_date: asOfDate,
        updated: false,
        created_at: now,
      });
      return "SKIPPED";
    }
    const updated: EmployeeContract = {
      ...previous,
      status,
      revision: previous.revision + 1,
      updated_by: actorId,
      updated_at: now,
      action_time: now,
      sync_time: now,
    };
    transaction.set(contractRef, updated);
    transaction.create(operationRef, {
      id: operationId,
      contract_id: contractId,
      as_of_date: asOfDate,
      previous_status: previous.status,
      next_status: status,
      updated: true,
      created_at: now,
    });
    transaction.create(db.collection(AUDITS).doc(operationId), {
      id: operationId,
      entity_type: "employee_contracts",
      entity_id: contractId,
      warehouse_id: previous.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: actorId,
      user_name: null,
      entity_name: previous.contract_number,
      action_time: now,
      sync_time: now,
      old_value: previous,
      new_value: updated,
      notes: `Automated contract status: ${previous.status} -> ${status}`,
    });
    return "UPDATED";
  });
