"use client";

import {
  EmployeeEmploymentStatus,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  UserX,
  X,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { EmployeeEmploymentHistory } from "./EmployeeEmploymentHistory";
import { EmploymentTransitionForm } from "./EmploymentTransitionForm";
import { useEmployeeEmploymentTransitionForm } from "./useEmployeeEmploymentTransitionForm";

interface EmployeeEmploymentModalProps {
  isOpen: boolean;
  profile: EmployeeProfile | null;
  onClose: () => void;
}

const statusConfig: Record<
  EmployeeEmploymentStatus,
  {
    bg: string;
    text: string;
    border: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
  }
> = {
  [EmployeeEmploymentStatus.PROBATION]: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: Clock,
  },
  [EmployeeEmploymentStatus.OFFICIAL]: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  [EmployeeEmploymentStatus.RESIGNED]: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: UserX,
  },
  [EmployeeEmploymentStatus.UNSPECIFIED]: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: Briefcase,
  },
};

const initials = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const state = useEmployeeEmploymentTransitionForm(profile);
  const currentStatus =
    profile?.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;

  if (!isOpen || !profile) return null;
  const status = statusConfig[currentStatus];
  const StatusIcon = status.icon;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex max-h-[90vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/10 text-sm font-bold text-[var(--color-brand-primary)]">
              {initials(profile.full_name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-bold text-[var(--color-text-primary)]">
                  {labels.title}
                </h2>
                <span className="rounded border border-slate-200/80 bg-slate-100 px-2 py-0.5 font-mono text-xxs font-semibold text-slate-600">
                  {profile.employee_code}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-3 truncate text-xs text-[var(--color-text-muted)]">
                <span className="font-semibold text-slate-700">
                  {profile.full_name}
                </span>
                {profile.job_title ? <span>• {profile.job_title}</span> : null}
                {profile.department ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={12} className="text-slate-400" />
                    {profile.department}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.bg} ${status.text} ${status.border}`}
            >
              <StatusIcon size={14} />
              <span>{statusLabels[currentStatus] || currentStatus}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={t.employeeManagement.actions.close}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-12">
          <div className="flex flex-col lg:col-span-5">
            <EmploymentTransitionForm
              profile={profile}
              state={state}
              labels={labels}
              statusLabels={statusLabels}
            />
          </div>
          <div className="flex flex-col lg:col-span-7">
            <EmployeeEmploymentHistory
              transitions={state.history.transitions}
              isLoading={state.history.isLoading}
              error={state.history.error}
              onCancel={(transition) => void state.cancelTransition(transition)}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
