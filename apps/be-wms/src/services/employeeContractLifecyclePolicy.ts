import {
  EmployeeContractStatus,
  EmployeeContractType,
  getNextContractLocalDate,
  isValidContractLocalDate,
  type EmployeeContract,
  type LocalDate,
  type RenewEmployeeContractInput,
} from "@bduck/shared-types";

import {
  createEmployeeContractPolicyIssue,
  createEmployeeContractPolicyMessage,
  hasUnsafeEmployeeContractQueryOperator,
  resolveEmployeeContractStatus,
  validateEmployeeContractDraft,
  type EmployeeContractPolicyIssue,
} from "./employeeContractPolicy.js";

const validateReason = (reason: string): EmployeeContractPolicyIssue[] => {
  const normalized = reason.trim();
  if (
    !normalized ||
    normalized.length > 1000 ||
    hasUnsafeEmployeeContractQueryOperator(normalized)
  ) {
    return [
      createEmployeeContractPolicyIssue(
        "CONTRACT_REASON_REQUIRED",
        "reason",
        createEmployeeContractPolicyMessage(
          "Lý do là bắt buộc, tối đa 1000 ký tự và không chứa toán tử truy vấn.",
          "原因必填，最多1000个字符，且不得包含查询操作符。",
        ),
      ),
    ];
  }
  return [];
};

export const validateEmployeeContractRenewal = (
  source: EmployeeContract,
  input: Pick<
    RenewEmployeeContractInput,
    "contract_number" | "contract_type" | "start_date" | "end_date"
  >,
  existingContracts: readonly EmployeeContract[],
): EmployeeContractPolicyIssue[] => {
  const issues: EmployeeContractPolicyIssue[] = [];
  if (
    source.is_deleted ||
    source.status === EmployeeContractStatus.CANCELLED ||
    source.status === EmployeeContractStatus.TERMINATED ||
    ![EmployeeContractType.FIXED_TERM, EmployeeContractType.SEASONAL].includes(
      source.contract_type,
    ) ||
    !source.end_date
  ) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_RENEWAL_NOT_ALLOWED",
        "contract_type",
        createEmployeeContractPolicyMessage(
          "Hợp đồng này không thể gia hạn.",
          "此合同不能续签。",
        ),
      ),
    );
  }
  if (input.contract_type !== source.contract_type) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_RENEWAL_TYPE_MISMATCH",
        "contract_type",
        createEmployeeContractPolicyMessage(
          "Gia hạn phải giữ nguyên loại hợp đồng.",
          "续签必须保持原合同类型。",
        ),
      ),
    );
  }
  const expectedStart = source.end_date
    ? getNextContractLocalDate(source.end_date)
    : null;
  if (!expectedStart || input.start_date !== expectedStart) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_RENEWAL_START_MISMATCH",
        "start_date",
        createEmployeeContractPolicyMessage(
          "Hợp đồng gia hạn phải bắt đầu vào ngày kế tiếp sau hợp đồng cũ.",
          "续签合同必须从原合同结束后的次日开始。",
        ),
      ),
    );
  }
  const existingRenewal = existingContracts.find(
    (contract) =>
      !contract.is_deleted &&
      contract.status !== EmployeeContractStatus.CANCELLED &&
      contract.renewed_from_contract_id === source.id,
  );
  if (existingRenewal) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_RENEWAL_ALREADY_EXISTS",
        "renewed_from_contract_id",
        createEmployeeContractPolicyMessage(
          "Hợp đồng đã có bản gia hạn.",
          "该合同已有续签记录。",
        ),
        existingRenewal.id,
      ),
    );
  }
  if (issues.length > 0) return issues;
  return validateEmployeeContractDraft(
    source.employee_profile_id,
    input,
    existingContracts,
  );
};

export const validateEmployeeContractCancellation = (
  contract: EmployeeContract,
  reason: string,
  asOfDate: LocalDate,
): EmployeeContractPolicyIssue[] => {
  const issues = validateReason(reason);
  if (
    contract.is_deleted ||
    resolveEmployeeContractStatus(contract, asOfDate) !==
      EmployeeContractStatus.UPCOMING
  ) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_CANCELLATION_NOT_ALLOWED",
        "status",
        createEmployeeContractPolicyMessage(
          "Chỉ có thể hủy hợp đồng chưa có hiệu lực.",
          "只能取消尚未生效的合同。",
        ),
      ),
    );
  }
  return issues;
};

export const validateEmployeeContractTermination = (
  contract: EmployeeContract,
  terminationDate: LocalDate,
  reason: string,
  asOfDate: LocalDate,
): EmployeeContractPolicyIssue[] => {
  const issues = validateReason(reason);
  if (
    contract.is_deleted ||
    resolveEmployeeContractStatus(contract, asOfDate) !==
      EmployeeContractStatus.ACTIVE
  ) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_TERMINATION_NOT_ALLOWED",
        "status",
        createEmployeeContractPolicyMessage(
          "Chỉ có thể chấm dứt hợp đồng đang có hiệu lực.",
          "只能终止当前生效的合同。",
        ),
      ),
    );
  }
  if (
    !isValidContractLocalDate(terminationDate) ||
    terminationDate < contract.start_date ||
    terminationDate > asOfDate ||
    (contract.end_date !== null && terminationDate > contract.end_date)
  ) {
    issues.push(
      createEmployeeContractPolicyIssue(
        "CONTRACT_DATE_INVALID",
        "termination_date",
        createEmployeeContractPolicyMessage(
          "Ngày chấm dứt phải nằm trong thời gian hợp đồng và không ở tương lai.",
          "终止日期必须在合同期限内且不得晚于当前日期。",
        ),
      ),
    );
  }
  return issues;
};
