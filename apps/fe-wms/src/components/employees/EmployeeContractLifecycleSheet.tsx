"use client";

import {
  formatContractDisplayDate,
  parseContractDisplayDate,
  type EmployeeContract,
  type LocalDate,
} from "@bduck/shared-types";
import { useEffect, useState, type FormEvent } from "react";
import { ContractDateField } from "./ContractDateField";
import { EmployeeContractSheet } from "./EmployeeContractSheet";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";
import { getCurrentContractLocalDate } from "./employeeContractUiPolicy";

export type EmployeeContractLifecycleMode = "cancel" | "terminate";

interface EmployeeContractLifecycleValues {
  reason: string;
  termination_date: LocalDate | null;
}

interface EmployeeContractLifecycleSheetProps {
  isOpen: boolean;
  mode: EmployeeContractLifecycleMode;
  contract: EmployeeContract | null;
  labels: EmployeeContractLabels;
  onClose: () => void;
  onSubmit: (values: EmployeeContractLifecycleValues) => Promise<void>;
}

export function EmployeeContractLifecycleSheet({
  isOpen,
  mode,
  contract,
  labels,
  onClose,
  onSubmit,
}: EmployeeContractLifecycleSheetProps) {
  const [reason, setReason] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    setTerminationDate(
      formatContractDisplayDate(getCurrentContractLocalDate()),
    );
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedDate =
      mode === "terminate" ? parseContractDisplayDate(terminationDate) : null;
    if (!reason.trim()) {
      setError(labels.form.required);
      return;
    }
    if (mode === "terminate" && !parsedDate) {
      setError(labels.form.invalidDate);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        reason: reason.trim(),
        termination_date: parsedDate,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    mode === "cancel" ? labels.form.cancelTitle : labels.form.terminateTitle;

  return (
    <EmployeeContractSheet
      isOpen={isOpen}
      title={title}
      closeLabel={labels.actions.close}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-xl bg-[var(--color-surface-card)] px-3 py-2">
          <p className="text-xxs text-[var(--color-text-muted)]">
            {labels.fields.contractNumber}
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {contract?.contract_number ?? "---"}
          </p>
        </div>
        {mode === "terminate" ? (
          <ContractDateField
            id="contract-termination-date"
            label={labels.fields.terminationDate}
            value={terminationDate}
            hint={labels.form.dateHint}
            error={error}
            required
            onChange={setTerminationDate}
          />
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.fields.reason}
            <span className="ml-1 text-red-600">*</span>
          </span>
          <textarea
            required
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
          />
          {error ? (
            <span className="mt-1 block text-xs text-red-600">{error}</span>
          ) : null}
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === "cancel" ? labels.actions.cancel : labels.actions.terminate}
        </button>
      </form>
    </EmployeeContractSheet>
  );
}
