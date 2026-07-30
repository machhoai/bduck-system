"use client";

import type { EmployeeContractMutationResult } from "@bduck/shared-types";

import {
  cancelEmployeeContract,
  createEmployeeContract,
  terminateEmployeeContract,
  updateEmployeeContract,
  uploadEmployeeContractPdf,
} from "@/api/employeeContractApi";

import type {
  EmploymentContractPlan,
  EmploymentContractResolution,
} from "./employmentTransitionContractPolicy";

export interface EmploymentContractSaveProgress {
  transitionCreated: boolean;
  oldContractResolved: boolean;
  resolvedContractId: string | null;
  contractId: string | null;
  pdfUploaded: boolean;
}

const resolveOldContract = async (input: {
  profileId: string;
  resolution: EmploymentContractResolution;
  reason: string;
  submissionId: string;
  fallbackMessage: string;
}): Promise<EmployeeContractMutationResult | null> => {
  const { resolution } = input;
  if (resolution.action === "NONE") return null;
  if (resolution.action === "BLOCKED") {
    throw new Error(input.fallbackMessage);
  }
  const common = {
    reason: input.reason,
    expected_revision: resolution.contract.revision,
    idempotency_key: `employment-contract-${resolution.action.toLowerCase()}-${input.submissionId}`,
    action_time: new Date(),
  };
  if (resolution.action === "CANCEL") {
    return cancelEmployeeContract(
      input.profileId,
      resolution.contract.id,
      common,
      input.fallbackMessage,
    );
  }
  if (resolution.action === "TERMINATE") {
    return terminateEmployeeContract(
      input.profileId,
      resolution.contract.id,
      { ...common, termination_date: resolution.resolution_date },
      input.fallbackMessage,
    );
  }
  return updateEmployeeContract(
    input.profileId,
    resolution.contract.id,
    {
      end_date: resolution.resolution_date,
      expected_revision: resolution.contract.revision,
      idempotency_key: common.idempotency_key,
      action_time: common.action_time,
    },
    input.fallbackMessage,
  );
};

export const executeEmploymentContractPlan = async (input: {
  profileId: string;
  plan: EmploymentContractPlan;
  pdfFile: File | null;
  reason: string;
  submissionId: string;
  progress: EmploymentContractSaveProgress;
  fallbackMessage: string;
  uploadErrorMessage: string;
}): Promise<EmploymentContractSaveProgress> => {
  const progress = input.progress;
  if (!input.plan.draft) return progress;

  if (!progress.oldContractResolved) {
    await resolveOldContract({
      profileId: input.profileId,
      resolution: input.plan.resolution,
      reason: input.reason,
      submissionId: input.submissionId,
      fallbackMessage: input.fallbackMessage,
    });
    progress.oldContractResolved = true;
    progress.resolvedContractId =
      input.plan.resolution.action === "NONE" ||
      input.plan.resolution.action === "BLOCKED"
        ? null
        : input.plan.resolution.contract.id;
  }

  if (!progress.contractId) {
    const result = await createEmployeeContract(
      input.profileId,
      {
        ...input.plan.draft,
        idempotency_key: `employment-official-contract-${input.submissionId}`,
        action_time: new Date(),
      },
      input.fallbackMessage,
    );
    progress.contractId = result.contract.id;
  }

  if (input.pdfFile && !progress.pdfUploaded) {
    await uploadEmployeeContractPdf(
      input.profileId,
      progress.contractId,
      input.pdfFile,
      input.uploadErrorMessage,
      `employment-official-pdf-${input.submissionId}`,
    );
    progress.pdfUploaded = true;
  }
  return progress;
};

export const createEmploymentContractSaveProgress =
  (): EmploymentContractSaveProgress => ({
    transitionCreated: false,
    oldContractResolved: false,
    resolvedContractId: null,
    contractId: null,
    pdfUploaded: false,
  });
