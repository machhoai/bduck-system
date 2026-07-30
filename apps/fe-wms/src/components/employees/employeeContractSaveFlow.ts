"use client";

import type {
  EmployeeContract,
  EmployeeContractMutationResult,
} from "@bduck/shared-types";

import {
  createEmployeeContract,
  renewEmployeeContract,
  updateEmployeeContract,
  uploadEmployeeContractPdf,
} from "@/api/employeeContractApi";

import type {
  EmployeeContractDraftValues,
  EmployeeContractFormMode,
} from "./EmployeeContractFormSheet";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";

export const executeEmployeeContractSave = async (input: {
  profileId: string;
  mode: EmployeeContractFormMode;
  sourceContract: EmployeeContract | null;
  values: EmployeeContractDraftValues;
  labels: EmployeeContractLabels;
}): Promise<EmployeeContractMutationResult> => {
  const {
    pdf_file: pdfFile,
    submission_id: submissionId,
    action_time: actionTime,
    ...contractDraft
  } = input.values;
  const result =
    input.mode === "edit" && input.sourceContract
      ? await updateEmployeeContract(
          input.profileId,
          input.sourceContract.id,
          {
            ...contractDraft,
            expected_revision: input.sourceContract.revision,
            idempotency_key: `contract-edit-${submissionId}`,
            action_time: actionTime,
          },
          input.labels.toasts.saveError,
        )
      : input.mode === "renew" && input.sourceContract
        ? await renewEmployeeContract(
            input.profileId,
            input.sourceContract.id,
            {
              ...contractDraft,
              expected_revision: input.sourceContract.revision,
              idempotency_key: `contract-renew-${submissionId}`,
              action_time: actionTime,
            },
            input.labels.toasts.saveError,
          )
        : await createEmployeeContract(
            input.profileId,
            {
              ...contractDraft,
              idempotency_key: `contract-create-${submissionId}`,
              action_time: actionTime,
            },
            input.labels.toasts.saveError,
          );

  if (pdfFile && input.mode !== "edit") {
    await uploadEmployeeContractPdf(
      input.profileId,
      result.contract.id,
      pdfFile,
      input.labels.toasts.uploadError,
      `contract-form-pdf-${submissionId}`,
    );
  }
  return result;
};
