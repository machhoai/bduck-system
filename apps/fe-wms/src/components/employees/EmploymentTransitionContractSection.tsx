"use client";

import {
  EmployeeContractType,
  formatContractDisplayDate,
  type EmployeeContract,
} from "@bduck/shared-types";
import { AlertTriangle, FileCheck2, LoaderCircle } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import type { EmployeeInitialContractFormState } from "./employeeInitialContractDraft";
import { EmployeeInitialContractSection } from "./EmployeeInitialContractSection";
import type {
  EmploymentContractResolution,
} from "./employmentTransitionContractPolicy";

interface EmployeeEmploymentContractPlanProps {
  value: EmployeeInitialContractFormState;
  resolution: EmploymentContractResolution;
  copy: {
    title: string;
    subtitle: string;
    enable: string;
    currentContract: string;
    cancel: string;
    terminate: string;
    shorten: string;
    blocked: string;
    missingLifecyclePermission: string;
    loading: string;
    loadError: string;
  };
  canManageDocuments: boolean;
  canResolveLifecycle: boolean;
  isLoading: boolean;
  loadError: string | null;
  validationError: string | null;
  onChange: Dispatch<SetStateAction<EmployeeInitialContractFormState>>;
}

const interpolate = (
  template: string,
  contract: EmployeeContract,
  date?: string,
) =>
  template
    .replace("{number}", contract.contract_number)
    .replace("{date}", date ?? "");

export function EmploymentTransitionContractSection({
  value,
  resolution,
  copy,
  canManageDocuments,
  canResolveLifecycle,
  isLoading,
  loadError,
  validationError,
  onChange,
}: EmployeeEmploymentContractPlanProps) {
  const lifecycleRequired = ["CANCEL", "TERMINATE"].includes(
    resolution.action,
  );
  const blocked =
    resolution.action === "BLOCKED" ||
    (lifecycleRequired && !canResolveLifecycle);

  let resolutionMessage: string | null = null;
  if (resolution.action === "CANCEL") {
    resolutionMessage = interpolate(copy.cancel, resolution.contract);
  } else if (
    resolution.action === "TERMINATE" ||
    resolution.action === "SHORTEN"
  ) {
    resolutionMessage = interpolate(
      copy[resolution.action === "TERMINATE" ? "terminate" : "shorten"],
      resolution.contract,
      formatContractDisplayDate(resolution.resolution_date),
    );
  } else if (resolution.action === "BLOCKED") {
    resolutionMessage = interpolate(copy.blocked, resolution.contract);
  }

  return (
    <div className="space-y-2.5">
      <EmployeeInitialContractSection
        value={value}
        canManageDocuments={canManageDocuments}
        error={validationError}
        copy={copy}
        allowedContractTypes={[
          EmployeeContractType.FIXED_TERM,
          EmployeeContractType.INDEFINITE,
          EmployeeContractType.SEASONAL,
        ]}
        lockStartDate
        onChange={onChange}
      />

      {value.enabled && isLoading ? (
        <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <LoaderCircle size={14} className="animate-spin" />
          {copy.loading}
        </p>
      ) : null}
      {value.enabled && loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {copy.loadError}
        </p>
      ) : null}
      {value.enabled && resolutionMessage ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            blocked
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            {blocked ? <AlertTriangle size={14} /> : <FileCheck2 size={14} />}
            {copy.currentContract}
          </p>
          <p>{resolutionMessage}</p>
          {lifecycleRequired && !canResolveLifecycle ? (
            <p className="mt-1 font-semibold">
              {copy.missingLifecyclePermission}
            </p>
          ) : null}
        </div>
      ) : null}
      {validationError ? (
        <p className="text-xs text-red-600">{validationError}</p>
      ) : null}
    </div>
  );
}
