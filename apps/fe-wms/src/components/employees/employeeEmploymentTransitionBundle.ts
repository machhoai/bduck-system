"use client";

import {
  EmployeeEmploymentStatus,
  type CreateEmployeeEmploymentTransitionInput,
  type EmployeeProfile,
} from "@bduck/shared-types";

import {
  executeEmploymentContractPlan,
  type EmploymentContractSaveProgress,
} from "./employeeEmploymentContractSaveFlow";
import type { EmploymentContractPlan } from "./employmentTransitionContractPolicy";

export const runEmployeeEmploymentTransitionBundle = async (input: {
  profile: EmployeeProfile;
  targetStatus: string;
  effectiveDate: string;
  probationEndDate: string;
  reason: string;
  plan: EmploymentContractPlan;
  pdfFile: File | null;
  submissionId: string;
  progress: EmploymentContractSaveProgress;
  createTransition: (
    input: CreateEmployeeEmploymentTransitionInput,
  ) => Promise<unknown>;
  contractReason: string;
  saveError: string;
  uploadError: string;
  partialFailure: string;
  transitionError: string;
}) => {
  try {
    if (!input.progress.transitionCreated) {
      await input.createTransition({
        to_status: input.targetStatus as Exclude<
          EmployeeEmploymentStatus,
          EmployeeEmploymentStatus.UNSPECIFIED
        >,
        effective_date: input.effectiveDate,
        probation_end_date:
          input.targetStatus === EmployeeEmploymentStatus.OFFICIAL
            ? input.probationEndDate || null
            : undefined,
        reason: input.reason,
      });
      input.progress.transitionCreated = true;
    }
    if (input.plan.draft) {
      await executeEmploymentContractPlan({
        profileId: input.profile.id,
        plan: input.plan,
        pdfFile: input.pdfFile,
        reason: input.contractReason,
        submissionId: input.submissionId,
        progress: input.progress,
        fallbackMessage: input.saveError,
        uploadErrorMessage: input.uploadError,
      });
    }
  } catch (error) {
    if (input.progress.transitionCreated && input.plan.draft) {
      const detail =
        error instanceof Error ? error.message : input.transitionError;
      throw new Error(`${input.partialFailure} ${detail}`);
    }
    throw error;
  }
};
