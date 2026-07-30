"use client";

import {
  EmployeeEmploymentTransitionStatus,
  type EmployeeEmploymentTransition,
} from "@bduck/shared-types";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";

interface EmployeeEmploymentHistoryProps {
  transitions: EmployeeEmploymentTransition[];
  isLoading: boolean;
  error: string | null;
  onCancel: (transition: EmployeeEmploymentTransition) => void;
}

const transitionStatusStyles: Record<
  EmployeeEmploymentTransitionStatus,
  {
    badge: string;
    nodeBorder: string;
    nodeBg: string;
    nodeText: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
  }
> = {
  [EmployeeEmploymentTransitionStatus.SCHEDULED]: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    nodeBorder: "border-amber-500",
    nodeBg: "bg-amber-50",
    nodeText: "text-amber-600",
    icon: Clock,
  },
  [EmployeeEmploymentTransitionStatus.APPLIED]: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    nodeBorder: "border-emerald-500",
    nodeBg: "bg-emerald-50",
    nodeText: "text-emerald-600",
    icon: CheckCircle2,
  },
  [EmployeeEmploymentTransitionStatus.CANCELLED]: {
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    nodeBorder: "border-slate-300",
    nodeBg: "bg-slate-100",
    nodeText: "text-slate-400",
    icon: XCircle,
  },
};

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
    <section className="flex h-full flex-col space-y-4 rounded-xl border border-[var(--color-border-subtle)] bg-white p-4.5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
            <History size={16} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {labels.historyTitle}
          </h3>
        </div>
        {transitions.length > 0 && (
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xxs font-semibold text-slate-600">
            {transitions.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        ) : transitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <History size={22} />
            </div>
            <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
              {labels.emptyHistory}
            </p>
          </div>
        ) : (
          <div className="relative space-y-4 py-2 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-[2px] before:bg-slate-200">
            {transitions.map((transition) => {
              const style =
                transitionStatusStyles[transition.status] ||
                transitionStatusStyles[
                  EmployeeEmploymentTransitionStatus.CANCELLED
                ];
              const NodeIcon = style.icon;

              return (
                <article
                  key={transition.id}
                  className="relative flex items-start gap-3 pl-0.5"
                >
                  {/* Timeline Node */}
                  <div
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-white ${style.nodeBorder} ${style.nodeBg} ${style.nodeText} shadow-xs`}
                  >
                    <NodeIcon size={14} />
                  </div>

                  {/* Content Card */}
                  <div className="flex-1 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 shadow-2xs transition-colors hover:border-slate-300">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <span>
                          {statusLabels[transition.from_status] ||
                            transition.from_status}
                        </span>
                        <ArrowRight size={13} className="text-slate-400" />
                        <span className="text-[var(--color-brand-primary)]">
                          {statusLabels[transition.to_status] ||
                            transition.to_status}
                        </span>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xxs font-semibold ${style.badge}`}
                      >
                        {transitionStatusLabels[transition.status] ||
                          transition.status}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <Calendar size={13} className="text-slate-400" />
                        <span>
                          {labels.effectiveDate}:{" "}
                          <strong className="text-slate-700 font-medium">
                            {transition.effective_date}
                          </strong>
                        </span>
                      </div>

                      {transition.reason && (
                        <p className="rounded-lg border border-slate-200/50 bg-white p-2 text-xs text-slate-600">
                          {transition.reason}
                        </p>
                      )}
                    </div>

                    {transition.status ===
                      EmployeeEmploymentTransitionStatus.SCHEDULED && (
                      <div className="mt-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onCancel(transition)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xxs font-semibold text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-700 active:scale-[0.98]"
                        >
                          <Ban size={12} />
                          <span>{labels.cancelScheduled}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

