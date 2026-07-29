import {
  EmployeeContractStatus,
  EmployeeContractType,
  type EmployeeContract,
  type LocalDate,
} from "@bduck/shared-types";

export const getCurrentContractLocalDate = (): LocalDate => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
};

export const resolveContractUiStatus = (
  contract: EmployeeContract,
  today = getCurrentContractLocalDate(),
): EmployeeContractStatus => {
  if (contract.status === EmployeeContractStatus.CANCELLED) {
    return EmployeeContractStatus.CANCELLED;
  }
  if (contract.termination_date) return EmployeeContractStatus.TERMINATED;
  if (today < contract.start_date) return EmployeeContractStatus.UPCOMING;
  if (contract.end_date && today > contract.end_date) {
    return EmployeeContractStatus.EXPIRED;
  }
  return EmployeeContractStatus.ACTIVE;
};

export const canRenewContract = (
  contract: EmployeeContract,
  today = getCurrentContractLocalDate(),
): boolean =>
  [EmployeeContractType.FIXED_TERM, EmployeeContractType.SEASONAL].includes(
    contract.contract_type,
  ) &&
  Boolean(contract.end_date) &&
  ![
    EmployeeContractStatus.CANCELLED,
    EmployeeContractStatus.TERMINATED,
  ].includes(resolveContractUiStatus(contract, today));

export const canCancelContract = (
  contract: EmployeeContract,
  today = getCurrentContractLocalDate(),
): boolean =>
  resolveContractUiStatus(contract, today) === EmployeeContractStatus.UPCOMING;

export const canTerminateContract = (
  contract: EmployeeContract,
  today = getCurrentContractLocalDate(),
): boolean =>
  resolveContractUiStatus(contract, today) === EmployeeContractStatus.ACTIVE;
