"use client";

import { EmployeeEmploymentStatus, type EmployeeProfile } from "@bduck/shared-types";
import { ArrowRight, CalendarClock } from "lucide-react";

import type { useTranslation } from "@/lib/i18n";

import { EmploymentTransitionContractSection } from "./EmploymentTransitionContractSection";
import type { useEmployeeEmploymentTransitionForm } from "./useEmployeeEmploymentTransitionForm";

type FormState = ReturnType<typeof useEmployeeEmploymentTransitionForm>;
type EmploymentLabels = ReturnType<
  typeof useTranslation
>["t"]["employeeManagement"]["employment"];

export function EmploymentTransitionForm({
  profile,
  state,
  labels,
  statusLabels,
}: {
  profile: EmployeeProfile;
  state: FormState;
  labels: EmploymentLabels;
  statusLabels: Record<string, string>;
}) {
  return (
    <form
      onSubmit={state.submit}
      className="flex h-full flex-col justify-between space-y-4 rounded-xl border border-[var(--color-border-subtle)] bg-white p-4.5 shadow-xs"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
            <CalendarClock size={16} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {labels.createTitle}
          </h3>
        </div>

        {state.targets.length === 0 ? (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-3.5 text-center text-xs text-[var(--color-text-muted)]">
            <p className="font-medium">{labels.noAvailableTransition}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <Field label={labels.targetStatus}>
              <select
                required
                value={state.targetStatus}
                disabled={state.isCompletingContractBundle}
                onChange={(event) => state.setTargetStatus(event.target.value)}
                className={inputClassName}
              >
                <option value="" disabled>
                  {labels.selectTarget}
                </option>
                {state.targets.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={labels.effectiveDate}>
              <input
                required
                type="date"
                value={state.effectiveDate}
                disabled={state.isCompletingContractBundle}
                onChange={(event) => state.setEffectiveDate(event.target.value)}
                className={inputClassName}
              />
            </Field>
            {state.targetStatus === EmployeeEmploymentStatus.OFFICIAL &&
            profile.employment_status === EmployeeEmploymentStatus.PROBATION ? (
              <Field label={labels.probationEndDate}>
                <input
                  required={!profile.probation_end_date}
                  type="date"
                  value={state.probationEndDate}
                  disabled={state.isCompletingContractBundle}
                  onChange={(event) =>
                    state.setProbationEndDate(event.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
            ) : null}
            <Field label={labels.reason}>
              <textarea
                required
                maxLength={1000}
                rows={4}
                disabled={state.isCompletingContractBundle}
                placeholder={labels.reasonPlaceholder || labels.reason}
                value={state.reason}
                onChange={(event) => state.setReason(event.target.value)}
                className="w-full resize-none rounded-lg border border-[var(--color-border-subtle)] bg-white p-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]"
              />
            </Field>
            {state.shouldOfferContract ? (
              <EmploymentTransitionContractSection
                value={state.contractForm}
                resolution={state.contractResolution}
                copy={state.contractCopy}
                canManageDocuments={state.canManageDocuments}
                canResolveLifecycle={state.canResolveLifecycle}
                isLoading={state.contracts.isLoading}
                loadError={state.contracts.error}
                validationError={state.contractError}
                onChange={state.setContractForm}
              />
            ) : null}
          </div>
        )}
      </div>
      {state.targets.length > 0 ? (
        <button
          type="submit"
          disabled={state.isSubmitting || !state.targetStatus}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[var(--color-brand-primary)]/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{labels.submit}</span>
          <ArrowRight size={14} />
        </button>
      ) : null}
    </form>
  );
}

const inputClassName =
  "h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
