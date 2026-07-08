"use client";

import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import {
  BriefcaseBusiness,
  ClipboardList,
  IdCard,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminRequestDraft } from "./AdminRequestDraft";
import { AdminRequestActions } from "./AdminRequestActions";
import { formatMaybeDate, valueOrEmpty } from "./adminOverviewUtils";
import {
  ActionButton,
  DetailGrid,
  EmptyState,
  ExpandablePanel,
  InfoPill,
  MetricTile,
} from "./AdminOverviewParts";
import { EmployeeAdminBottomSheet } from "../EmployeeAdminBottomSheet";

type ExtendedEmployeeProfile = EmployeeProfile & {
  social_insurance_code?: string | null;
  probation_start_date?: Date | string | null;
  probation_end_date?: Date | string | null;
  official_start_date?: Date | string | null;
  resignation_date?: Date | string | null;
  appointment_history?: Array<{
    id?: string;
    title?: string | null;
    department?: string | null;
    effective_from?: Date | string | null;
    effective_to?: Date | string | null;
  }>;
};

type SheetKey = "profile" | "appointments" | "request" | null;

interface AdminOverviewTabProps {
  labels: Record<string, string>;
  profile: EmployeeProfile | null;
  warehouse: Warehouse | null;
  loading: boolean;
}

export function AdminOverviewTab({
  labels,
  profile,
  warehouse,
  loading,
}: AdminOverviewTabProps) {
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
  const [expandedPanel, setExpandedPanel] = useState<SheetKey>(null);
  const extendedProfile = profile as ExtendedEmployeeProfile | null;
  const emptyLabel = labels.notUpdated || "Not updated";

  const profileFields = useMemo(
    () => [
      {
        label: labels.employeeCode,
        value: valueOrEmpty(extendedProfile?.employee_code, emptyLabel),
      },
      {
        label: labels.fullName,
        value: valueOrEmpty(extendedProfile?.full_name, emptyLabel),
      },
      {
        label: labels.department,
        value: valueOrEmpty(extendedProfile?.department, emptyLabel),
      },
      {
        label: labels.jobTitle,
        value: valueOrEmpty(extendedProfile?.job_title, emptyLabel),
      },
      {
        label: labels.workplace,
        value: warehouse?.name || emptyLabel,
      },
      {
        label: labels.socialInsuranceCode,
        value: valueOrEmpty(extendedProfile?.social_insurance_code, emptyLabel),
      },
      {
        label: labels.probationStartDate,
        value: formatMaybeDate(extendedProfile?.probation_start_date, emptyLabel),
      },
      {
        label: labels.probationEndDate,
        value: formatMaybeDate(extendedProfile?.probation_end_date, emptyLabel),
      },
      {
        label: labels.officialStartDate,
        value: formatMaybeDate(extendedProfile?.official_start_date, emptyLabel),
      },
      {
        label: labels.resignationDate,
        value: formatMaybeDate(extendedProfile?.resignation_date, emptyLabel),
      },
    ],
    [emptyLabel, extendedProfile, labels, warehouse?.name],
  );

  const appointments = extendedProfile?.appointment_history || [];

  if (loading) {
    return (
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="h-52 animate-pulse rounded-[28px] bg-white" />
        <div className="h-52 animate-pulse rounded-[28px] bg-white" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1.12fr_0.88fr] lg:gap-4">
      {/* Left Column: Profile Details & Appointments */}
      <div className="flex flex-col gap-3 lg:gap-4 min-w-0">
        {/* Profile Card */}
        <section
          data-employee-admin-animate
          className="rounded-[28px] border border-white/80 bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:p-5 lg:shadow-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase text-[var(--color-text-muted)] tracking-wider">
                {labels.personalInfo}
              </p>
              <h2 className="mt-1 truncate text-base font-semibold text-[var(--color-text-primary)]">
                {profile?.full_name || labels.employeeProfile}
              </h2>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
              <IdCard size={18} />
            </div>
          </div>

          {/* On Mobile: show 4 fields + sheet buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
            {profileFields.slice(0, 4).map((field) => (
              <InfoPill key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:hidden">
            <ActionButton
              icon={<UserRound size={16} />}
              label={labels.viewFullProfile}
              onClick={() => setActiveSheet("profile")}
            />
            <ActionButton
              icon={<BriefcaseBusiness size={16} />}
              label={labels.viewAppointments}
              onClick={() => setActiveSheet("appointments")}
            />
          </div>

          {/* On Desktop: show all fields directly in high-density grid */}
          <div className="mt-4 hidden lg:grid lg:grid-cols-2 lg:gap-2.5">
            {profileFields.map((field) => (
              <InfoPill key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </section>

        {/* Appointment History Panel on Desktop */}
        <section
          data-employee-admin-animate
          className="hidden lg:block rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-white p-5"
        >
          <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-3">
            <BriefcaseBusiness size={16} className="text-[var(--color-brand-primary)] shrink-0" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {labels.appointmentHistory || "Lịch sử bổ nhiệm"}
            </h3>
          </div>
          <div className="mt-4">
            {appointments.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {appointments.map((item, index) => (
                  <div
                    key={item.id || `${item.title || "appointment"}-${index}`}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3"
                  >
                    <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {item.title || emptyLabel}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                      {item.department || emptyLabel}
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-[var(--color-text-secondary)]">
                      Hiệu lực: {formatMaybeDate(item.effective_from, emptyLabel)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title={labels.noAppointments} hint={labels.noAppointmentsHint} />
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Leave Balance & Quick Actions */}
      <div className="flex flex-col gap-3 lg:gap-4 min-w-0">
        {/* Leave Balance Card */}
        <section
          data-employee-admin-animate
          className="rounded-[28px] border border-white/80 bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:p-5 lg:shadow-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase text-[var(--color-text-muted)] tracking-wider">
                {labels.leaveBalance}
              </p>
              <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                {labels.leaveBalanceTitle}
              </h2>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#257a3e10] text-[#257a3e]">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricTile label={labels.availableLeave} value="--" tone="success" />
            <MetricTile label={labels.pendingLeave} value="--" />
            <MetricTile label={labels.usedLeave} value="--" tone="warning" />
          </div>

          <p className="mt-3 rounded-2xl bg-[var(--color-surface-card)] px-3 py-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
            {labels.leaveBalanceHint}
          </p>

          <button
            type="button"
            onClick={() => setActiveSheet("request")}
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand-primary)] px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] w-fit lg:w-full"
          >
            <Plus size={14} />
            <span>{labels.createRequest}</span>
          </button>
        </section>

        {/* Admin Requests and Quick Actions */}
        <section
          data-employee-admin-animate
          className="rounded-[28px] border border-white/80 bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:p-5 lg:shadow-none"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase text-[var(--color-text-muted)] tracking-wider">
                {labels.adminRequests}
              </p>
              <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                {labels.quickActions}
              </h2>
            </div>
            <ClipboardList className="text-[var(--color-brand-primary)]" size={18} />
          </div>

          <AdminRequestActions
            labels={labels}
            onSelect={() => setActiveSheet("request")}
          />

          <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {labels.noRequests}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {labels.noRequestsHint}
            </p>
          </div>
        </section>
      </div>

      {/* Sheets / Modals */}
      <EmployeeAdminBottomSheet
        open={activeSheet === "profile"}
        title={labels.fullProfile}
        description={labels.fullProfileHint}
        onClose={() => setActiveSheet(null)}
      >
        <DetailGrid fields={profileFields} />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "appointments"}
        title={labels.appointmentHistory}
        description={labels.appointmentHistoryHint}
        onClose={() => setActiveSheet(null)}
      >
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((item, index) => (
              <div
                key={item.id || `${item.title || "appointment"}-${index}`}
                className="rounded-2xl border border-[var(--color-border-soft)] p-3"
              >
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {item.title || emptyLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {item.department || emptyLabel}
                </p>
                <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
                  {formatMaybeDate(item.effective_from, emptyLabel)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={labels.noAppointments} hint={labels.noAppointmentsHint} />
        )}
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "request"}
        title={labels.createRequest}
        description={labels.createRequestHint}
        onClose={() => setActiveSheet(null)}
      >
        <AdminRequestDraft labels={labels} />
      </EmployeeAdminBottomSheet>
    </div>
  );
}
