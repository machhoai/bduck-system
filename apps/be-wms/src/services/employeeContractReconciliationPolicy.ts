import {
  EmployeeContractStatus,
  type EmployeeContract,
  type LocalDate,
  type LocalizedText,
} from "@bduck/shared-types";
import {
  doEmployeeContractPeriodsOverlap,
  normalizeEmployeeContractNumber,
} from "./employeeContractPolicy.js";
import { resolveAutomatedEmployeeContractStatus } from "./employeeContractAutomationPolicy.js";

export type EmployeeContractReconciliationIssueCode =
  | "DUPLICATE_CONTRACT_NUMBER"
  | "CONTRACT_PERIOD_OVERLAP"
  | "NORMALIZED_NUMBER_DRIFT"
  | "STATUS_DRIFT"
  | "NUMBER_LOCK_MISSING"
  | "NUMBER_LOCK_MISMATCH"
  | "NUMBER_LOCK_ORPHANED";

export interface EmployeeContractNumberLockView {
  id: string;
  contract_number_normalized: string;
  contract_id: string;
  is_deleted: boolean;
}

export interface EmployeeContractReconciliationIssue {
  code: EmployeeContractReconciliationIssueCode;
  contract_ids: string[];
  messages: LocalizedText;
  repairable: boolean;
}

export interface EmployeeContractReconciliationPlan {
  scanned_contracts: number;
  scanned_locks: number;
  duplicate_numbers: number;
  overlaps: number;
  projection_drifts: number;
  lock_issues: number;
  blocking_issues: number;
  repair_contract_ids: string[];
  issues: EmployeeContractReconciliationIssue[];
}

const message = (vi: string, zh: string): LocalizedText => ({ vi, zh });

export const reconcileEmployeeContracts = (
  contracts: readonly EmployeeContract[],
  locks: readonly EmployeeContractNumberLockView[],
  asOfDate: LocalDate,
): EmployeeContractReconciliationPlan => {
  const issues: EmployeeContractReconciliationIssue[] = [];
  const activeContracts = contracts.filter((contract) => !contract.is_deleted);
  const contractsById = new Map(contracts.map((item) => [item.id, item]));
  const locksByNumber = new Map(
    locks
      .filter((lock) => !lock.is_deleted)
      .map((lock) => [lock.contract_number_normalized, lock]),
  );
  const numberGroups = new Map<string, EmployeeContract[]>();
  for (const contract of contracts) {
    const normalized = normalizeEmployeeContractNumber(
      contract.contract_number,
    );
    numberGroups.set(normalized, [
      ...(numberGroups.get(normalized) ?? []),
      contract,
    ]);
    if (contract.contract_number_normalized !== normalized) {
      issues.push({
        code: "NORMALIZED_NUMBER_DRIFT",
        contract_ids: [contract.id],
        messages: message(
          `Số hợp đồng ${contract.contract_number} có giá trị chuẩn hóa không khớp.`,
          `合同编号 ${contract.contract_number} 的标准化值不匹配。`,
        ),
        repairable: true,
      });
    }
  }

  for (const [normalized, group] of numberGroups) {
    if (group.length > 1) {
      issues.push({
        code: "DUPLICATE_CONTRACT_NUMBER",
        contract_ids: group.map((contract) => contract.id),
        messages: message(
          `Số hợp đồng ${normalized} đang được dùng bởi nhiều bản ghi.`,
          `合同编号 ${normalized} 被多个记录使用。`,
        ),
        repairable: false,
      });
      continue;
    }
    const contract = group[0];
    const lock = locksByNumber.get(normalized);
    if (!lock) {
      issues.push({
        code: "NUMBER_LOCK_MISSING",
        contract_ids: [contract.id],
        messages: message(
          `Số hợp đồng ${normalized} chưa có number lock.`,
          `合同编号 ${normalized} 缺少编号锁。`,
        ),
        repairable: true,
      });
    } else if (lock.contract_id !== contract.id) {
      issues.push({
        code: "NUMBER_LOCK_MISMATCH",
        contract_ids: [contract.id, lock.contract_id],
        messages: message(
          `Number lock của ${normalized} đang trỏ sai hợp đồng.`,
          `${normalized} 的编号锁指向错误的合同。`,
        ),
        repairable: false,
      });
    }
  }

  for (const lock of locks.filter((item) => !item.is_deleted)) {
    if (!contractsById.has(lock.contract_id)) {
      issues.push({
        code: "NUMBER_LOCK_ORPHANED",
        contract_ids: [lock.contract_id],
        messages: message(
          `Number lock ${lock.contract_number_normalized} không còn hợp đồng nguồn.`,
          `编号锁 ${lock.contract_number_normalized} 已无对应合同。`,
        ),
        repairable: false,
      });
    }
  }

  const byProfile = new Map<string, EmployeeContract[]>();
  for (const contract of activeContracts) {
    byProfile.set(contract.employee_profile_id, [
      ...(byProfile.get(contract.employee_profile_id) ?? []),
      contract,
    ]);
    const expected = resolveAutomatedEmployeeContractStatus(
      contract,
      asOfDate,
    );
    if (
      ![
        EmployeeContractStatus.CANCELLED,
        EmployeeContractStatus.TERMINATED,
      ].includes(contract.status) &&
      contract.status !== expected
    ) {
      issues.push({
        code: "STATUS_DRIFT",
        contract_ids: [contract.id],
        messages: message(
          `Trạng thái hợp đồng ${contract.contract_number} phải là ${expected}.`,
          `合同 ${contract.contract_number} 的状态应为 ${expected}。`,
        ),
        repairable: true,
      });
    }
  }
  for (const group of byProfile.values()) {
    for (let left = 0; left < group.length; left++) {
      for (let right = left + 1; right < group.length; right++) {
        if (doEmployeeContractPeriodsOverlap(group[left], group[right])) {
          issues.push({
            code: "CONTRACT_PERIOD_OVERLAP",
            contract_ids: [group[left].id, group[right].id],
            messages: message(
              "Một nhân viên có nhiều hợp đồng trùng khoảng hiệu lực.",
              "同一员工存在有效期重叠的多份合同。",
            ),
            repairable: false,
          });
        }
      }
    }
  }

  const repairContractIds = Array.from(
    new Set(
      issues
        .filter((issue) => issue.repairable)
        .flatMap((issue) => issue.contract_ids)
        .filter((id) => contractsById.has(id)),
    ),
  );
  return {
    scanned_contracts: contracts.length,
    scanned_locks: locks.length,
    duplicate_numbers: issues.filter(
      (issue) => issue.code === "DUPLICATE_CONTRACT_NUMBER",
    ).length,
    overlaps: issues.filter(
      (issue) => issue.code === "CONTRACT_PERIOD_OVERLAP",
    ).length,
    projection_drifts: issues.filter((issue) =>
      ["NORMALIZED_NUMBER_DRIFT", "STATUS_DRIFT"].includes(issue.code),
    ).length,
    lock_issues: issues.filter((issue) => issue.code.includes("LOCK")).length,
    blocking_issues: issues.filter((issue) => !issue.repairable).length,
    repair_contract_ids: repairContractIds,
    issues,
  };
};
