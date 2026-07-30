import {
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  EmployeeContractType,
  parseContractDisplayDate,
  type LocalDate,
} from "@bduck/shared-types";

export interface EmployeeInitialContractFormState {
  enabled: boolean;
  contract_number: string;
  contract_type: EmployeeContractType;
  start_date: string;
  end_date: string;
  notes: string;
  pdf_file: File | null;
}

export interface EmployeeInitialContractDraft {
  contract_number: string;
  contract_type: EmployeeContractType;
  start_date: LocalDate;
  end_date: LocalDate | null;
  notes: string | null;
}

export interface EmployeeProfileContractBundle {
  submission_id: string;
  contract: EmployeeInitialContractDraft | null;
  pdf_file: File | null;
}

export type EmployeeInitialContractValidationError =
  | "REQUIRED"
  | "INVALID_DATE"
  | "INVALID_PDF";

export const emptyInitialContractForm =
  (): EmployeeInitialContractFormState => ({
    enabled: false,
    contract_number: "",
    contract_type: EmployeeContractType.FIXED_TERM,
    start_date: "",
    end_date: "",
    notes: "",
    pdf_file: null,
  });

export const buildEmployeeInitialContractDraft = (
  form: EmployeeInitialContractFormState,
):
  | { ok: true; value: EmployeeInitialContractDraft | null }
  | { ok: false; error: EmployeeInitialContractValidationError } => {
  if (!form.enabled) return { ok: true, value: null };

  const startDate = parseContractDisplayDate(form.start_date);
  const isIndefinite = form.contract_type === EmployeeContractType.INDEFINITE;
  const endDate = isIndefinite ? null : parseContractDisplayDate(form.end_date);

  if (!form.contract_number.trim()) {
    return { ok: false, error: "REQUIRED" };
  }
  if (
    !startDate ||
    (!isIndefinite && !endDate) ||
    (endDate !== null && endDate < startDate)
  ) {
    return { ok: false, error: "INVALID_DATE" };
  }

  return {
    ok: true,
    value: {
      contract_number: form.contract_number.trim(),
      contract_type: form.contract_type,
      start_date: startDate,
      end_date: endDate,
      notes: form.notes.trim() || null,
    },
  };
};

export const buildEmployeeProfileContractBundle = (input: {
  form: EmployeeInitialContractFormState;
  canManageContract: boolean;
  canManageDocument: boolean;
  submissionId: string;
}):
  | { ok: true; value: EmployeeProfileContractBundle }
  | { ok: false; error: EmployeeInitialContractValidationError } => {
  const form = input.canManageContract
    ? input.form
    : emptyInitialContractForm();
  const contractResult = buildEmployeeInitialContractDraft(form);
  if (!contractResult.ok) return contractResult;

  const pdfFile =
    input.canManageDocument && contractResult.value ? form.pdf_file : null;
  if (
    pdfFile &&
    !(
      (pdfFile.type === "application/pdf" ||
        pdfFile.name.toLocaleLowerCase().endsWith(".pdf")) &&
      pdfFile.size > 0 &&
      pdfFile.size <= EMPLOYEE_CONTRACT_PDF_MAX_BYTES
    )
  ) {
    return { ok: false, error: "INVALID_PDF" };
  }

  return {
    ok: true,
    value: {
      submission_id: input.submissionId,
      contract: contractResult.value,
      pdf_file: pdfFile,
    },
  };
};
