"use client";

import {
  EmployeeEmploymentStatus,
  formatContractDisplayDate,
  type EmployeeEmploymentTransition,
  type EmployeeProfile,
  type LocalDate,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useMemo, useRef, useState } from "react";

import { useEmployeeContractLabels } from "@/hooks/useEmployeeContractLabels";
import { useEmployeeContracts } from "@/hooks/useEmployeeContracts";
import { useEmployeeEmploymentTransitions } from "@/hooks/useEmployeeEmploymentTransitions";
import { isEmployeeContractsFeatureEnabled } from "@/lib/employeeContractFeatureFlag";
import { useTranslation } from "@/lib/i18n";
import { employeeEmploymentContractTranslations } from "@/lib/i18n/employeeEmploymentContractTranslations";
import { useUserStore } from "@/stores/useUserStore";

import { getCurrentContractLocalDate } from "./employeeContractUiPolicy";
import {
  createEmploymentContractSaveProgress,
  type EmploymentContractSaveProgress,
} from "./employeeEmploymentContractSaveFlow";
import { runEmployeeEmploymentTransitionBundle } from "./employeeEmploymentTransitionBundle";
import {
  buildEmployeeProfileContractBundle,
  emptyInitialContractForm,
} from "./employeeInitialContractDraft";
import {
  buildEmploymentContractPlan,
  type EmploymentContractPlan,
} from "./employmentTransitionContractPolicy";

const targetsByStatus: Record<
  EmployeeEmploymentStatus,
  EmployeeEmploymentStatus[]
> = {
  [EmployeeEmploymentStatus.UNSPECIFIED]: [
    EmployeeEmploymentStatus.PROBATION,
    EmployeeEmploymentStatus.OFFICIAL,
    EmployeeEmploymentStatus.RESIGNED,
  ],
  [EmployeeEmploymentStatus.PROBATION]: [
    EmployeeEmploymentStatus.OFFICIAL,
    EmployeeEmploymentStatus.RESIGNED,
  ],
  [EmployeeEmploymentStatus.OFFICIAL]: [EmployeeEmploymentStatus.RESIGNED],
  [EmployeeEmploymentStatus.RESIGNED]: [],
};

export function useEmployeeEmploymentTransitionForm(
  profile: EmployeeProfile | null,
) {
  const { t, lang } = useTranslation();
  const labels = t.employeeManagement.employment;
  const contractLabels = useEmployeeContractLabels();
  const contractCopy = employeeEmploymentContractTranslations[lang];
  const hasPermission = useUserStore((state) => state.hasPermission);
  const history = useEmployeeEmploymentTransitions(
    profile?.id ?? null,
    profile?.workplace_warehouse_id ?? null,
  );
  const canManageContracts =
    isEmployeeContractsFeatureEnabled &&
    Boolean(
      profile &&
        hasPermission(
          "employees.contracts.manage",
          profile.workplace_warehouse_id,
        ),
    );
  const canManageDocuments = Boolean(
    profile &&
      hasPermission(
        "employees.contracts.documents.manage",
        profile.workplace_warehouse_id,
      ),
  );
  const canResolveLifecycle = Boolean(
    profile &&
      hasPermission(
        "employees.contracts.terminate",
        profile.workplace_warehouse_id,
      ),
  );
  const contracts = useEmployeeContracts(
    canManageContracts ? profile?.id ?? null : null,
    canManageContracts ? profile?.user_id ?? null : null,
    canManageContracts ? profile?.workplace_warehouse_id ?? null : null,
    contractLabels.loadError,
  );
  const [targetStatus, setTargetStatus] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [probationEndDate, setProbationEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompletingContractBundle, setIsCompletingContractBundle] =
    useState(false);
  const [contractForm, setContractForm] = useState(emptyInitialContractForm);
  const [contractError, setContractError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const progressRef = useRef(
    new Map<string, EmploymentContractSaveProgress>(),
  );
  const currentStatus =
    profile?.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;
  const targets = useMemo(
    () =>
      isCompletingContractBundle
        ? [EmployeeEmploymentStatus.OFFICIAL]
        : targetsByStatus[currentStatus],
    [currentStatus, isCompletingContractBundle],
  );
  const shouldOfferContract =
    canManageContracts &&
    ((currentStatus === EmployeeEmploymentStatus.PROBATION &&
      targetStatus === EmployeeEmploymentStatus.OFFICIAL) ||
      isCompletingContractBundle);
  const currentProgress = progressRef.current.get(submissionId);
  const planResult = useMemo(
    () =>
      buildEmploymentContractPlan({
        form: shouldOfferContract
          ? contractForm
          : { ...contractForm, enabled: false },
        contracts: contracts.contracts.filter(
          (contract) =>
            contract.id !== currentProgress?.contractId &&
            contract.id !== currentProgress?.resolvedContractId,
        ),
        today: getCurrentContractLocalDate(),
      }),
    [
      contractForm,
      contracts.contracts,
      currentProgress?.contractId,
      currentProgress?.resolvedContractId,
      shouldOfferContract,
    ],
  );

  useEffect(() => {
    setContractForm((current) => ({
      ...current,
      start_date: formatContractDisplayDate(
        (effectiveDate || null) as LocalDate | null,
      ),
    }));
    setContractError(null);
  }, [effectiveDate]);

  const validateContractPlan = (): EmploymentContractPlan | null => {
    if (!shouldOfferContract || !contractForm.enabled) {
      return { draft: null, resolution: { action: "NONE" } };
    }
    const bundle = buildEmployeeProfileContractBundle({
      form: contractForm,
      canManageContract: canManageContracts,
      canManageDocument: canManageDocuments,
      submissionId,
    });
    if (!bundle.ok) {
      setContractError(
        bundle.error === "INVALID_PDF"
          ? contractCopy.invalidPdf
          : bundle.error === "INVALID_DATE"
            ? contractCopy.invalidDate
            : contractCopy.required,
      );
      return null;
    }
    if (!planResult.ok) {
      setContractError(
        planResult.error === "INVALID_DATE"
          ? contractCopy.invalidDate
          : contractCopy.required,
      );
      return null;
    }
    const plan = planResult.value;
    const requiresLifecycle = ["CANCEL", "TERMINATE"].includes(
      plan.resolution.action,
    );
    if (
      contracts.isLoading ||
      contracts.error ||
      plan.resolution.action === "BLOCKED" ||
      (requiresLifecycle && !canResolveLifecycle)
    ) {
      setContractError(
        contracts.error
          ? contractCopy.loadError
          : plan.resolution.action === "BLOCKED"
            ? contractCopy.blocked.replace(
                "{number}",
                plan.resolution.contract.contract_number,
              )
            : contractCopy.missingLifecyclePermission,
      );
      return null;
    }
    return plan;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !targetStatus) return;
    const plan = validateContractPlan();
    if (!plan) return;
    setContractError(null);
    setIsSubmitting(true);
    const progress =
      progressRef.current.get(submissionId) ??
      createEmploymentContractSaveProgress();
    progressRef.current.set(submissionId, progress);
    try {
      await gooeyToast.promise(
        runEmployeeEmploymentTransitionBundle({
          profile,
          targetStatus,
          effectiveDate,
          probationEndDate,
          reason,
          plan,
          pdfFile: contractForm.pdf_file,
          submissionId,
          progress,
          createTransition: history.createTransition,
          contractReason: contractCopy.reason,
          saveError: contractLabels.toasts.saveError,
          uploadError: contractLabels.toasts.uploadError,
          partialFailure: contractCopy.partialFailure,
          transitionError: labels.toasts.createError,
        }),
        {
          loading: plan.draft ? contractCopy.resolving : labels.toasts.creating,
          success: labels.toasts.created,
          error: (error: unknown) =>
            error instanceof Error ? error.message : labels.toasts.createError,
        },
      );
      setTargetStatus("");
      setEffectiveDate("");
      setProbationEndDate("");
      setReason("");
      setContractForm(emptyInitialContractForm());
      setSubmissionId(crypto.randomUUID());
      setIsCompletingContractBundle(false);
      progressRef.current.delete(submissionId);
    } catch {
      // The toast exposes the localized error; retry progress stays in memory.
      if (progress.transitionCreated && plan.draft) {
        setIsCompletingContractBundle(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTransition = async (
    transition: EmployeeEmploymentTransition,
  ) => {
    const cancellationReason = window.prompt(labels.cancelReasonPrompt);
    if (!cancellationReason?.trim()) return;
    await gooeyToast.promise(
      history.cancelTransition(transition.id, {
        reason: cancellationReason.trim(),
      }),
      {
        loading: labels.toasts.cancelling,
        success: labels.toasts.cancelled,
        error: (error: unknown) =>
          error instanceof Error ? error.message : labels.toasts.cancelError,
      },
    );
  };

  return {
    history,
    targets,
    targetStatus,
    setTargetStatus,
    effectiveDate,
    setEffectiveDate,
    probationEndDate,
    setProbationEndDate,
    reason,
    setReason,
    isSubmitting,
    isCompletingContractBundle,
    shouldOfferContract,
    contractForm,
    setContractForm,
    contractError,
    contractResolution: planResult.ok
      ? planResult.value.resolution
      : ({ action: "NONE" } as const),
    contractCopy,
    contracts,
    canManageDocuments,
    canResolveLifecycle,
    submit,
    cancelTransition,
  };
}
