import {
  EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS,
  EmployeeContractStatus,
  EmployeeContractType,
  addContractLocalDays,
  differenceInContractLocalDays,
  type EmployeeContract,
  type LocalDate,
} from "@bduck/shared-types";
import { resolveEmployeeContractStatus } from "./employeeContractPolicy.js";

const FINAL_STATUSES = new Set<EmployeeContractStatus>([
  EmployeeContractStatus.CANCELLED,
  EmployeeContractStatus.TERMINATED,
]);

export const resolveAutomatedEmployeeContractStatus = (
  contract: EmployeeContract,
  asOfDate: LocalDate,
): EmployeeContractStatus =>
  FINAL_STATUSES.has(contract.status)
    ? contract.status
    : resolveEmployeeContractStatus(contract, asOfDate);

export const getEmployeeContractWarningDate = (
  contract: Pick<EmployeeContract, "end_date">,
): LocalDate | null =>
  contract.end_date
    ? addContractLocalDays(
        contract.end_date,
        -EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS,
      )
    : null;

export const isEmployeeContractExpiryWarningDue = (
  contract: EmployeeContract,
  asOfDate: LocalDate,
): boolean => {
  if (
    contract.is_deleted ||
    contract.contract_type === EmployeeContractType.SEASONAL ||
    FINAL_STATUSES.has(contract.status) ||
    !contract.end_date
  ) {
    return false;
  }
  const remaining = differenceInContractLocalDays(
    contract.end_date,
    asOfDate,
  );
  return (
    remaining !== null &&
    remaining >= 0 &&
    remaining <= EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS
  );
};

export const isEmployeeContractExpiringSoon = (
  contract: EmployeeContract,
  asOfDate: LocalDate,
): boolean => {
  if (
    contract.is_deleted ||
    contract.contract_type === EmployeeContractType.SEASONAL ||
    FINAL_STATUSES.has(contract.status) ||
    !contract.end_date
  ) {
    return false;
  }
  const remaining = differenceInContractLocalDays(
    contract.end_date,
    asOfDate,
  );
  return (
    remaining !== null &&
    remaining >= 0 &&
    remaining <= EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS
  );
};
