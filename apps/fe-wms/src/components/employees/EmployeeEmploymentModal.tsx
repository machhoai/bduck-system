"use client";

import {
  EmployeeEmploymentStatus,
  type EmployeeEmploymentTransition,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { motion } from "framer-motion";
import { CalendarClock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { gooeyToast } from "goey-toast";
import { useEmployeeEmploymentTransitions } from "@/hooks/useEmployeeEmploymentTransitions";
import { useTranslation } from "@/lib/i18n";
import { EmployeeEmploymentHistory } from "./EmployeeEmploymentHistory";

interface EmployeeEmploymentModalProps {
  isOpen: boolean;
  profile: EmployeeProfile | null;
  onClose: () => void;
}

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

export function EmployeeEmploymentModal({
  isOpen,
  profile,
  onClose,
}: EmployeeEmploymentModalProps) {
  const { t } = useTranslation();
  const labels = t.employeeManagement.employment;
  const statusLabels = t.employeeManagement.employmentStatusLabels as Record<
    string,
    string
  >;
  const history = useEmployeeEmploymentTransitions(
    profile?.id ?? null,
    profile?.workplace_warehouse_id ?? null,
  );
  const [targetStatus, setTargetStatus] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [probationEndDate, setProbationEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentStatus =
    profile?.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;
  const targets = useMemo(
    () => targetsByStatus[currentStatus],
    [currentStatus],
  );

  if (!isOpen || !profile) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetStatus) return;
    setIsSubmitting(true);
    try {
      await gooeyToast.promise(
        history.createTransition({
          to_status: targetStatus as Exclude<
            EmployeeEmploymentStatus,
            EmployeeEmploymentStatus.UNSPECIFIED
          >,
          effective_date: effectiveDate,
          probation_end_date:
            targetStatus === EmployeeEmploymentStatus.OFFICIAL
              ? probationEndDate || null
              : undefined,
          reason,
        }),
        {
          loading: labels.toasts.creating,
          success: labels.toasts.created,
          error: (error: unknown) =>
            error instanceof Error ? error.message : labels.toasts.createError,
        },
      );
      setTargetStatus("");
      setEffectiveDate("");
      setProbationEndDate("");
      setReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTransition = async (transition: EmployeeEmploymentTransition) => {
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

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {labels.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {profile.full_name} · {profile.employee_code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
            aria-label={t.employeeManagement.actions.close}
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <form
            onSubmit={submit}
            className="h-fit space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4"
          >
            <div className="flex items-center gap-2">
              <CalendarClock
                size={17}
                className="text-[var(--color-brand-primary)]"
              />
              <h3 className="text-sm font-semibold">{labels.createTitle}</h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {labels.currentStatus}: {statusLabels[currentStatus]}
            </p>
            {targets.length === 0 ? (
              <p className="rounded-xl bg-[var(--color-surface-card)] p-3 text-xs text-[var(--color-text-muted)]">
                {labels.noAvailableTransition}
              </p>
            ) : (
              <>
                <Field label={labels.targetStatus}>
                  <select
                    required
                    value={targetStatus}
                    onChange={(event) => setTargetStatus(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      {labels.selectTarget}
                    </option>
                    {targets.map((status) => (
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
                    value={effectiveDate}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                    className={inputClassName}
                  />
                </Field>
                {targetStatus === EmployeeEmploymentStatus.OFFICIAL &&
                  currentStatus === EmployeeEmploymentStatus.PROBATION && (
                    <Field label={labels.probationEndDate}>
                      <input
                        required={!profile.probation_end_date}
                        type="date"
                        value={probationEndDate}
                        onChange={(event) =>
                          setProbationEndDate(event.target.value)
                        }
                        className={inputClassName}
                      />
                    </Field>
                  )}
                <Field label={labels.reason}>
                  <textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {labels.submit}
                </button>
              </>
            )}
          </form>

          <EmployeeEmploymentHistory
            transitions={history.transitions}
            isLoading={history.isLoading}
            error={history.error}
            onCancel={(transition) => void cancelTransition(transition)}
          />
        </div>
      </motion.div>
    </div>
  );
}

const inputClassName =
  "h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
