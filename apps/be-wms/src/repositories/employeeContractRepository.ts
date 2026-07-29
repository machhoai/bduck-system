import {
  AuditAction,
  type EmployeeContract,
  type EmployeeContractMutationResult,
  type LocalizedText,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";

import { db } from "../config/firebase.js";
import {
  mapFirestoreDocument,
  toFirestoreDate,
} from "./facilityAccessRepositoryUtils.js";

export const EMPLOYEE_CONTRACTS_COLLECTION = "employee_contracts";
export const EMPLOYEE_CONTRACT_LOCKS_COLLECTION =
  "employee_contract_number_locks";
export const EMPLOYEE_CONTRACT_OPERATIONS_COLLECTION =
  "employee_contract_operations";
export const EMPLOYEE_PROFILES_COLLECTION = "employee_profiles";

const CONTRACT_DATE_FIELDS = [
  "created_at",
  "updated_at",
  "action_time",
  "sync_time",
];
const CONTRACT_NULLABLE_DATE_FIELDS = ["terminated_at", "cancelled_at"];

export interface EmployeeContractAuditMetadata {
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
}

export interface EmployeeContractOperationContext extends EmployeeContractAuditMetadata {
  actor_id: string;
  action_time: Date;
  idempotency_key: string;
}

export type EmployeeContractOperationAction =
  | "CREATE"
  | "UPDATE"
  | "RENEW"
  | "CANCEL"
  | "TERMINATE";

interface PreparedOperation {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  request_hash: string;
  replay: EmployeeContractMutationResult | null;
}

export const contractError = (
  code: string,
  messages: LocalizedText,
  statusCode = 409,
  data?: unknown,
) => ({ code, messages, statusCode, data });

export const employeeContractRef = (contractId: string) =>
  db.collection(EMPLOYEE_CONTRACTS_COLLECTION).doc(contractId);

export const employeeContractNumberLockRef = (normalizedNumber: string) =>
  db
    .collection(EMPLOYEE_CONTRACT_LOCKS_COLLECTION)
    .doc(createHash("sha256").update(normalizedNumber).digest("hex"));

export const mapEmployeeContractSnapshot = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeContract =>
  mapFirestoreDocument<EmployeeContract>(
    snapshot,
    CONTRACT_DATE_FIELDS,
    CONTRACT_NULLABLE_DATE_FIELDS,
  );

const mapStoredContract = (
  value: Record<string, unknown>,
): EmployeeContract => {
  const result = { ...value };
  CONTRACT_DATE_FIELDS.forEach((field) => {
    result[field] = toFirestoreDate(result[field]);
  });
  CONTRACT_NULLABLE_DATE_FIELDS.forEach((field) => {
    result[field] =
      result[field] == null ? null : toFirestoreDate(result[field]);
  });
  return result as unknown as EmployeeContract;
};

const stableValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const prepareEmployeeContractOperation = async (
  transaction: FirebaseFirestore.Transaction,
  action: EmployeeContractOperationAction,
  context: EmployeeContractOperationContext,
  request: unknown,
): Promise<PreparedOperation> => {
  const id = sha256(`${context.actor_id}:${action}:${context.idempotency_key}`);
  const ref = db.collection(EMPLOYEE_CONTRACT_OPERATIONS_COLLECTION).doc(id);
  const requestHash = sha256(JSON.stringify(stableValue(request)));
  const snapshot = await transaction.get(ref);
  if (!snapshot.exists) {
    return { id, ref, request_hash: requestHash, replay: null };
  }
  if (snapshot.get("request_hash") !== requestHash) {
    throw contractError(
      "CONTRACT_IDEMPOTENCY_CONFLICT",
      {
        vi: "Khóa chống trùng đã được dùng cho một yêu cầu khác.",
        zh: "幂等键已用于其他请求。",
      },
      409,
    );
  }
  const storedContract = snapshot.get("result_contract");
  const storedSource = snapshot.get("result_source_contract");
  if (!storedContract || typeof storedContract !== "object") {
    throw contractError(
      "CONTRACT_OPERATION_CORRUPTED",
      {
        vi: "Không thể đọc kết quả thao tác hợp đồng trước đó.",
        zh: "无法读取先前的合同操作结果。",
      },
      500,
    );
  }
  return {
    id,
    ref,
    request_hash: requestHash,
    replay: {
      contract: mapStoredContract(storedContract),
      source_contract:
        storedSource && typeof storedSource === "object"
          ? mapStoredContract(storedSource)
          : null,
      replayed: true,
    },
  };
};

export const writeEmployeeContractOperation = (
  transaction: FirebaseFirestore.Transaction,
  prepared: PreparedOperation,
  action: EmployeeContractOperationAction,
  context: EmployeeContractOperationContext,
  result: Omit<EmployeeContractMutationResult, "replayed">,
  syncTime: Date,
) => {
  transaction.create(prepared.ref, {
    id: prepared.id,
    action,
    actor_id: context.actor_id,
    idempotency_key: context.idempotency_key,
    request_hash: prepared.request_hash,
    result_contract: result.contract,
    result_source_contract: result.source_contract,
    action_time: context.action_time,
    sync_time: syncTime,
    created_at: syncTime,
  });
};

export const assertContractNumberLockAvailable = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
  contractId: string,
) => {
  if (snapshot.exists && snapshot.get("contract_id") !== contractId) {
    throw contractError("CONTRACT_NUMBER_DUPLICATE", {
      vi: "Số hợp đồng đã được sử dụng trong toàn công ty.",
      zh: "该合同编号已在公司范围内使用。",
    });
  }
};

export const writeEmployeeContractNumberLock = (
  transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  snapshot: FirebaseFirestore.DocumentSnapshot,
  contract: EmployeeContract,
  context: EmployeeContractOperationContext,
  syncTime: Date,
) => {
  assertContractNumberLockAvailable(snapshot, contract.id);
  transaction.set(
    ref,
    {
      id: ref.id,
      contract_number_normalized: contract.contract_number_normalized,
      contract_id: contract.id,
      employee_profile_id: contract.employee_profile_id,
      workplace_warehouse_id: contract.workplace_warehouse_id,
      created_by: snapshot.exists
        ? snapshot.get("created_by")
        : context.actor_id,
      created_at: snapshot.exists ? snapshot.get("created_at") : syncTime,
      last_contract_revision: contract.revision,
      updated_at: syncTime,
      action_time: context.action_time,
      sync_time: syncTime,
      is_deleted: false,
    },
    { merge: true },
  );
};

export const writeEmployeeContractAudit = (
  transaction: FirebaseFirestore.Transaction,
  operationId: string,
  suffix: string,
  action: AuditAction,
  context: EmployeeContractOperationContext,
  oldValue: EmployeeContract | null,
  newValue: EmployeeContract,
  syncTime: Date,
) => {
  const auditId = `${operationId}:${suffix}`;
  transaction.create(db.collection("audit_logs").doc(auditId), {
    id: auditId,
    entity_type: EMPLOYEE_CONTRACTS_COLLECTION,
    entity_id: newValue.id,
    warehouse_id: newValue.workplace_warehouse_id,
    action,
    user_id: context.actor_id,
    user_name: null,
    entity_name: newValue.contract_number,
    action_time: context.action_time,
    sync_time: syncTime,
    old_value: oldValue,
    new_value: newValue,
    ip_address: context.ip_address ?? null,
    device_id: context.device_id ?? null,
    session_token: context.session_token ? sha256(context.session_token) : null,
    notes: `Employee contract ${suffix.toLowerCase()}`,
  });
};
