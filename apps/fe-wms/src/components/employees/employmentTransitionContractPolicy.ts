import {
  addContractLocalDays,
  EmployeeContractStatus,
  type EmployeeContract,
  type LocalDate,
} from "@bduck/shared-types";

import { resolveContractUiStatus } from "./employeeContractUiPolicy";
import {
  buildEmployeeInitialContractDraft,
  type EmployeeInitialContractDraft,
  type EmployeeInitialContractFormState,
  type EmployeeInitialContractValidationError,
} from "./employeeInitialContractDraft";

export type EmploymentContractResolution =
  | { action: "NONE" }
  | { action: "CANCEL"; contract: EmployeeContract }
  | {
      action: "TERMINATE" | "SHORTEN";
      contract: EmployeeContract;
      resolution_date: LocalDate;
    }
  | { action: "BLOCKED"; contract: EmployeeContract };

export interface EmploymentContractPlan {
  draft: EmployeeInitialContractDraft | null;
  resolution: EmploymentContractResolution;
}

const effectiveEnd = (contract: EmployeeContract) =>
  contract.termination_date ?? contract.end_date;

const overlapsDraft = (
  contract: EmployeeContract,
  draft: EmployeeInitialContractDraft,
) => {
  if (
    contract.is_deleted ||
    contract.status === EmployeeContractStatus.CANCELLED
  ) {
    return false;
  }
  const currentEnd = effectiveEnd(contract);
  return (
    (draft.end_date === null || contract.start_date <= draft.end_date) &&
    (currentEnd === null || draft.start_date <= currentEnd)
  );
};

export const buildEmploymentContractPlan = (input: {
  form: EmployeeInitialContractFormState;
  contracts: readonly EmployeeContract[];
  today: LocalDate;
}):
  | { ok: true; value: EmploymentContractPlan }
  | { ok: false; error: EmployeeInitialContractValidationError } => {
  const draftResult = buildEmployeeInitialContractDraft(input.form);
  if (!draftResult.ok) return draftResult;
  const draft = draftResult.value;
  if (!draft) {
    return { ok: true, value: { draft: null, resolution: { action: "NONE" } } };
  }

  const conflict = input.contracts.find((contract) =>
    overlapsDraft(contract, draft),
  );
  if (!conflict) {
    return { ok: true, value: { draft, resolution: { action: "NONE" } } };
  }

  const status = resolveContractUiStatus(conflict, input.today);
  if (status === EmployeeContractStatus.UPCOMING) {
    return {
      ok: true,
      value: { draft, resolution: { action: "CANCEL", contract: conflict } },
    };
  }

  const resolutionDate = addContractLocalDays(draft.start_date, -1);
  if (
    status !== EmployeeContractStatus.ACTIVE ||
    !resolutionDate ||
    resolutionDate < conflict.start_date
  ) {
    return {
      ok: true,
      value: { draft, resolution: { action: "BLOCKED", contract: conflict } },
    };
  }

  if (draft.start_date <= input.today) {
    return {
      ok: true,
      value: {
        draft,
        resolution: {
          action: "TERMINATE",
          contract: conflict,
          resolution_date: resolutionDate,
        },
      },
    };
  }

  if (conflict.end_date !== null) {
    return {
      ok: true,
      value: {
        draft,
        resolution: {
          action: "SHORTEN",
          contract: conflict,
          resolution_date: resolutionDate,
        },
      },
    };
  }

  return {
    ok: true,
    value: { draft, resolution: { action: "BLOCKED", contract: conflict } },
  };
};
