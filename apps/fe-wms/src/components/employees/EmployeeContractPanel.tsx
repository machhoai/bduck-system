"use client";

import {
  EmployeeContractStatus,
  type EmployeeContract,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { FilePlus2, Sheet } from "lucide-react";
import { useEffect, useState } from "react";

import {
  cancelEmployeeContract,
  createContractIdempotencyKey,
  createEmployeeContract,
  renewEmployeeContract,
  terminateEmployeeContract,
  updateEmployeeContract,
} from "@/api/employeeContractApi";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEmployeeContracts } from "@/hooks/useEmployeeContracts";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useTranslation } from "@/lib/i18n";
import { employeeContractImportTranslations } from "@/lib/i18n/employeeContractImportTranslations";
import { showToast } from "@/utils/toast";

import { EmployeeContractActionBar } from "./EmployeeContractActionBar";
import { EmployeeContractDocuments } from "./EmployeeContractDocuments";
import {
  EmployeeContractFormSheet,
  type EmployeeContractDraftValues,
  type EmployeeContractFormMode,
} from "./EmployeeContractFormSheet";
import { EmployeeContractImportSheet } from "./EmployeeContractImportSheet";
import {
  EmployeeContractLifecycleSheet,
  type EmployeeContractLifecycleMode,
} from "./EmployeeContractLifecycleSheet";
import { EmployeeContractTimeline } from "./EmployeeContractTimeline";
import { resolveContractUiStatus } from "./employeeContractUiPolicy";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";

interface EmployeeContractPanelProps {
  profile: EmployeeProfile;
  labels: EmployeeContractLabels;
  canRead: boolean;
  canManage: boolean;
  canTerminate: boolean;
  canReadDocuments: boolean;
  canManageDocuments: boolean;
  canImportHistory?: boolean;
}

const errorDescription = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function EmployeeContractPanel({
  profile,
  labels,
  canRead,
  canManage,
  canTerminate,
  canReadDocuments,
  canManageDocuments,
  canImportHistory = false,
}: EmployeeContractPanelProps) {
  const { lang } = useTranslation();
  const importLabels = employeeContractImportTranslations[lang];
  const { contracts, isLoading, error, source } = useEmployeeContracts(
    canRead ? profile.id : null,
    profile.user_id,
    profile.workplace_warehouse_id,
    labels.loadError,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    mode: EmployeeContractFormMode;
    contract: EmployeeContract | null;
  } | null>(null);
  const [lifecycle, setLifecycle] = useState<{
    mode: EmployeeContractLifecycleMode;
    contract: EmployeeContract;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (
      contracts.length > 0 &&
      !contracts.some((item) => item.id === selectedId)
    ) {
      const active =
        contracts.find(
          (item) =>
            resolveContractUiStatus(item) === EmployeeContractStatus.ACTIVE,
        ) ?? contracts[0];
      setSelectedId(active.id);
    }
    if (contracts.length === 0) setSelectedId(null);
  }, [contracts, selectedId]);

  if (!canRead && !canManage && !canImportHistory) return null;
  const selected =
    contracts.find((contract) => contract.id === selectedId) ?? null;

  const saveContract = async (values: EmployeeContractDraftValues) => {
    const actionTime = new Date();
    const operation =
      form?.mode === "edit" && form.contract
        ? updateEmployeeContract(
            profile.id,
            form.contract.id,
            {
              ...values,
              expected_revision: form.contract.revision,
              idempotency_key: createContractIdempotencyKey("contract-edit"),
              action_time: actionTime,
            },
            labels.toasts.saveError,
          )
        : form?.mode === "renew" && form.contract
          ? renewEmployeeContract(
              profile.id,
              form.contract.id,
              {
                ...values,
                expected_revision: form.contract.revision,
                idempotency_key: createContractIdempotencyKey("contract-renew"),
                action_time: actionTime,
              },
              labels.toasts.saveError,
            )
          : createEmployeeContract(
              profile.id,
              {
                ...values,
                idempotency_key:
                  createContractIdempotencyKey("contract-create"),
                action_time: actionTime,
              },
              labels.toasts.saveError,
            );
    try {
      await showToast.promise(operation, {
        loading:
          form?.mode === "renew"
            ? labels.toasts.renewing
            : labels.toasts.saving,
        success:
          form?.mode === "renew" ? labels.toasts.renewed : labels.toasts.saved,
        error: labels.toasts.saveError,
        successDescription: values.contract_number,
        errorDescription: (caught) =>
          errorDescription(caught, labels.toasts.saveError),
        retry: () => void saveContract(values),
        retryLabel: labels.toasts.retry,
      });
      emitDataMutation(["employee_contracts"]);
      setForm(null);
    } catch (caught) {
      console.error("[EmployeeContractPanel] save error:", caught);
    }
  };

  const applyLifecycle = async (values: {
    reason: string;
    termination_date: string | null;
  }) => {
    if (!lifecycle) return;
    const common = {
      reason: values.reason,
      expected_revision: lifecycle.contract.revision,
      idempotency_key: createContractIdempotencyKey(
        `contract-${lifecycle.mode}`,
      ),
      action_time: new Date(),
    };
    const operation =
      lifecycle.mode === "cancel"
        ? cancelEmployeeContract(
            profile.id,
            lifecycle.contract.id,
            common,
            labels.toasts.saveError,
          )
        : terminateEmployeeContract(
            profile.id,
            lifecycle.contract.id,
            { ...common, termination_date: values.termination_date! },
            labels.toasts.saveError,
          );
    try {
      await showToast.promise(operation, {
        loading:
          lifecycle.mode === "cancel"
            ? labels.toasts.cancelling
            : labels.toasts.terminating,
        success:
          lifecycle.mode === "cancel"
            ? labels.toasts.cancelled
            : labels.toasts.terminated,
        error: labels.toasts.saveError,
        successDescription: lifecycle.contract.contract_number,
        errorDescription: (caught) =>
          errorDescription(caught, labels.toasts.saveError),
        retry: () => void applyLifecycle(values),
        retryLabel: labels.toasts.retry,
      });
      emitDataMutation(["employee_contracts"]);
      setLifecycle(null);
    } catch (caught) {
      console.error("[EmployeeContractPanel] lifecycle error:", caught);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider">
            {labels.title}
          </h4>
          <p className="mt-1 text-xxs text-[var(--color-text-muted)]">
            {labels.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canImportHistory ? (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-blue-200 px-3 text-xs font-semibold text-blue-700"
            >
              <Sheet size={13} />
              {importLabels.open}
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => setForm({ mode: "create", contract: null })}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white"
            >
              <FilePlus2 size={13} />
              {labels.create}
            </button>
          ) : null}
        </div>
      </div>
      {canRead ? (isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      ) : contracts.length === 0 ? (
        <p className="rounded-xl bg-[var(--color-surface-card)] p-3 text-xs text-[var(--color-text-muted)]">
          {labels.empty}
        </p>
      ) : (
        <>
          {selected ? (
            <EmployeeContractActionBar
              contract={selected}
              labels={labels}
              canManage={canManage}
              canTerminate={canTerminate}
              onEdit={() => setForm({ mode: "edit", contract: selected })}
              onRenew={() => setForm({ mode: "renew", contract: selected })}
              onLifecycle={(mode) => setLifecycle({ mode, contract: selected })}
            />
          ) : null}
          <EmployeeContractTimeline
            contracts={contracts}
            selectedId={selectedId}
            labels={labels}
            onSelect={(contract) => setSelectedId(contract.id)}
          />
          {selected && canReadDocuments ? (
            <EmployeeContractDocuments
              profile={profile}
              contract={selected}
              labels={labels}
              canRead={canReadDocuments}
              canManage={canManageDocuments}
            />
          ) : null}
          <p className="text-right text-xxs text-[var(--color-text-muted)]">
            {source === "realtime" ? labels.realtime : labels.apiFallback}
          </p>
        </>
      )) : null}
      <EmployeeContractFormSheet
        isOpen={form !== null}
        mode={form?.mode ?? "create"}
        contract={form?.contract ?? null}
        labels={labels}
        onClose={() => setForm(null)}
        onSubmit={saveContract}
      />
      <EmployeeContractLifecycleSheet
        isOpen={lifecycle !== null}
        mode={lifecycle?.mode ?? "cancel"}
        contract={lifecycle?.contract ?? null}
        labels={labels}
        onClose={() => setLifecycle(null)}
        onSubmit={applyLifecycle}
      />
      <EmployeeContractImportSheet
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </section>
  );
}
