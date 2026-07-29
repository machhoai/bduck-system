import {
  EmployeeContractStatus,
  EmployeeContractType,
  isValidContractLocalDate,
  type CreateEmployeeContractInput,
  type EmployeeContract,
  type LocalDate,
  type LocalizedText,
} from "@bduck/shared-types";

export type EmployeeContractPolicyIssueCode =
  | "CONTRACT_NUMBER_REQUIRED"
  | "CONTRACT_NUMBER_INVALID"
  | "CONTRACT_NUMBER_DUPLICATE"
  | "CONTRACT_DATE_INVALID"
  | "CONTRACT_END_DATE_REQUIRED"
  | "CONTRACT_END_DATE_FORBIDDEN"
  | "CONTRACT_DATE_ORDER_INVALID"
  | "CONTRACT_PERIOD_OVERLAP"
  | "CONTRACT_RENEWAL_NOT_ALLOWED"
  | "CONTRACT_RENEWAL_ALREADY_EXISTS"
  | "CONTRACT_RENEWAL_TYPE_MISMATCH"
  | "CONTRACT_RENEWAL_START_MISMATCH"
  | "CONTRACT_CANCELLATION_NOT_ALLOWED"
  | "CONTRACT_TERMINATION_NOT_ALLOWED"
  | "CONTRACT_REASON_REQUIRED";

export interface EmployeeContractPolicyIssue {
  code: EmployeeContractPolicyIssueCode;
  field: string;
  messages: LocalizedText;
  conflicting_contract_id?: string;
}

type ContractPeriod = Pick<
  EmployeeContract,
  | "id"
  | "start_date"
  | "end_date"
  | "termination_date"
  | "status"
  | "is_deleted"
>;

export const createEmployeeContractPolicyMessage = (
  vi: string,
  zh: string,
): LocalizedText => ({ vi, zh });

export const createEmployeeContractPolicyIssue = (
  code: EmployeeContractPolicyIssueCode,
  field: string,
  messages: LocalizedText,
  conflictingContractId?: string,
): EmployeeContractPolicyIssue => ({
  code,
  field,
  messages,
  ...(conflictingContractId
    ? { conflicting_contract_id: conflictingContractId }
    : {}),
});

const message = createEmployeeContractPolicyMessage;
const createIssue = createEmployeeContractPolicyIssue;

const SAFE_CONTRACT_NUMBER_PATTERN =
  /^[\p{L}\p{N}._:/-]+(?: [\p{L}\p{N}._:/-]+)*$/u;
const UNSAFE_QUERY_PATTERN = /\$(?:where|ne|gt|gte|lt|lte|in|nin|or|and)\b/iu;

export const hasUnsafeEmployeeContractQueryOperator = (
  value: string,
): boolean => UNSAFE_QUERY_PATTERN.test(value);

export const normalizeEmployeeContractNumber = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toUpperCase();

const validateContractNumber = (
  value: string,
): EmployeeContractPolicyIssue[] => {
  const normalized = normalizeEmployeeContractNumber(value);
  if (!normalized) {
    return [
      createIssue(
        "CONTRACT_NUMBER_REQUIRED",
        "contract_number",
        message("Số hợp đồng là bắt buộc.", "合同编号为必填项。"),
      ),
    ];
  }
  if (
    normalized.length > 120 ||
    !SAFE_CONTRACT_NUMBER_PATTERN.test(normalized) ||
    hasUnsafeEmployeeContractQueryOperator(normalized)
  ) {
    return [
      createIssue(
        "CONTRACT_NUMBER_INVALID",
        "contract_number",
        message(
          "Số hợp đồng không hợp lệ hoặc vượt quá 120 ký tự.",
          "合同编号无效或超过120个字符。",
        ),
      ),
    ];
  }
  return [];
};

const requiresEndDate = (type: EmployeeContractType): boolean =>
  type !== EmployeeContractType.INDEFINITE;

const isInactivePeriod = (contract: ContractPeriod): boolean =>
  contract.is_deleted || contract.status === EmployeeContractStatus.CANCELLED;

export const getEmployeeContractEffectiveEnd = (
  contract: Pick<EmployeeContract, "termination_date" | "end_date">,
): LocalDate | null => contract.termination_date ?? contract.end_date;

export const doEmployeeContractPeriodsOverlap = (
  left: ContractPeriod,
  right: ContractPeriod,
): boolean => {
  if (isInactivePeriod(left) || isInactivePeriod(right)) return false;
  const leftEnd = getEmployeeContractEffectiveEnd(left);
  const rightEnd = getEmployeeContractEffectiveEnd(right);
  return (
    (rightEnd === null || left.start_date <= rightEnd) &&
    (leftEnd === null || right.start_date <= leftEnd)
  );
};

export const resolveEmployeeContractStatus = (
  contract: Pick<
    EmployeeContract,
    "status" | "start_date" | "end_date" | "termination_date"
  >,
  asOfDate: LocalDate,
): EmployeeContractStatus => {
  if (contract.status === EmployeeContractStatus.CANCELLED) {
    return EmployeeContractStatus.CANCELLED;
  }
  if (contract.termination_date && contract.termination_date <= asOfDate) {
    return EmployeeContractStatus.TERMINATED;
  }
  if (asOfDate < contract.start_date) return EmployeeContractStatus.UPCOMING;
  if (contract.end_date && asOfDate > contract.end_date) {
    return EmployeeContractStatus.EXPIRED;
  }
  return EmployeeContractStatus.ACTIVE;
};

export const validateEmployeeContractDraft = (
  employeeProfileId: string,
  input: Pick<
    CreateEmployeeContractInput,
    "contract_number" | "contract_type" | "start_date" | "end_date"
  >,
  existingContracts: readonly EmployeeContract[],
  ignoredContractId?: string,
): EmployeeContractPolicyIssue[] => {
  const issues = validateContractNumber(input.contract_number);
  const normalizedNumber = normalizeEmployeeContractNumber(
    input.contract_number,
  );
  const duplicate = existingContracts.find(
    (contract) =>
      contract.id !== ignoredContractId &&
      contract.contract_number_normalized === normalizedNumber,
  );
  if (normalizedNumber && duplicate) {
    issues.push(
      createIssue(
        "CONTRACT_NUMBER_DUPLICATE",
        "contract_number",
        message(
          "Số hợp đồng đã được sử dụng trong toàn công ty.",
          "该合同编号已在公司范围内使用。",
        ),
        duplicate.id,
      ),
    );
  }

  const startValid = isValidContractLocalDate(input.start_date);
  const endValid =
    input.end_date === null || isValidContractLocalDate(input.end_date);
  if (!startValid || !endValid) {
    issues.push(
      createIssue(
        "CONTRACT_DATE_INVALID",
        !startValid ? "start_date" : "end_date",
        message("Ngày hợp đồng không hợp lệ.", "合同日期无效。"),
      ),
    );
  }
  if (requiresEndDate(input.contract_type) && input.end_date === null) {
    issues.push(
      createIssue(
        "CONTRACT_END_DATE_REQUIRED",
        "end_date",
        message(
          "Loại hợp đồng này bắt buộc có ngày kết thúc.",
          "此合同类型必须填写结束日期。",
        ),
      ),
    );
  }
  if (
    input.contract_type === EmployeeContractType.INDEFINITE &&
    input.end_date !== null
  ) {
    issues.push(
      createIssue(
        "CONTRACT_END_DATE_FORBIDDEN",
        "end_date",
        message(
          "Hợp đồng không xác định thời hạn không có ngày kết thúc.",
          "无固定期限合同不得填写结束日期。",
        ),
      ),
    );
  }
  if (
    startValid &&
    input.end_date &&
    endValid &&
    input.end_date < input.start_date
  ) {
    issues.push(
      createIssue(
        "CONTRACT_DATE_ORDER_INVALID",
        "end_date",
        message(
          "Ngày kết thúc không được trước ngày bắt đầu.",
          "结束日期不得早于开始日期。",
        ),
      ),
    );
  }
  if (
    !startValid ||
    !endValid ||
    issues.some((item) =>
      [
        "CONTRACT_END_DATE_REQUIRED",
        "CONTRACT_END_DATE_FORBIDDEN",
        "CONTRACT_DATE_ORDER_INVALID",
      ].includes(item.code),
    )
  ) {
    return issues;
  }

  const candidate: ContractPeriod = {
    id: ignoredContractId ?? "candidate",
    start_date: input.start_date,
    end_date: input.end_date,
    termination_date: null,
    status: EmployeeContractStatus.UPCOMING,
    is_deleted: false,
  };
  const overlap = existingContracts.find(
    (contract) =>
      contract.id !== ignoredContractId &&
      contract.employee_profile_id === employeeProfileId &&
      doEmployeeContractPeriodsOverlap(candidate, contract),
  );
  if (overlap) {
    issues.push(
      createIssue(
        "CONTRACT_PERIOD_OVERLAP",
        "start_date",
        message(
          "Nhân viên đã có hợp đồng trong khoảng thời gian này.",
          "该员工在此时间段内已有合同。",
        ),
        overlap.id,
      ),
    );
  }
  return issues;
};
