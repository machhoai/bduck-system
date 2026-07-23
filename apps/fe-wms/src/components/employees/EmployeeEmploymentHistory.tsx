"use client";

import {
  EmployeeEmploymentTransitionStatus,
  type EmployeeEmploymentTransition,
} from "@bduck/shared-types";
import { History } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";

interface EmployeeEmploymentHistoryProps {
  transitions: EmployeeEmploymentTransition[];
  isLoading: boolean;
  error: string | null;
  onCancel: (transition: EmployeeEmploymentTransition) => void;
}

export function EmployeeEmploymentHistory({
  transitions,
  isLoading,
  error,
  onCancel,
}: EmployeeEmploymentHistoryProps) {
  const { t } = useTranslation();
  const labels = t.employeeManagement.employment;
  const statusLabels = t.employeeManagement.employmentStatusLabels as Record<
    string,
    string
  >;
  const transitionStatusLabels = labels.transitionStatus as Record<
    string,
    string
  >;

  return (
    <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
      <div className="flex items-center gap-2">
        <History size={17} className="text-[var(--color-brand-primary)]" />
        <h3 className="text-sm font-semibold">{labels.historyTitle}</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <p className="text-xs text-[#b42318]">{error}</p>
      ) : transitions.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          {labels.emptyHistory}
        </p>
      ) : (
        <div className="space-y-2">
          {transitions.map((transition) => (
            <article
              key={transition.id}
              className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">
                    {statusLabels[transition.from_status]} →{" "}
                    {statusLabels[transition.to_status]}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {labels.effectiveDate}: {transition.effective_date}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--color-border-subtle)] bg-white px-2 py-0.5 text-xxs font-semibold">
                  {transitionStatusLabels[transition.status]}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {transition.reason}
              </p>
              {transition.status ===
                EmployeeEmploymentTransitionStatus.SCHEDULED && (
                <button
                  type="button"
                  onClick={() => onCancel(transition)}
                  className="mt-2 text-xs font-semibold text-[#b42318] hover:underline"
                >
                  {labels.cancelScheduled}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
