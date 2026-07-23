"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
} from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import {
  profileStatusLabel,
  type EmployeeProfileFormState,
} from "./employeeProfileFormTypes";

interface EmployeeProfileFieldsProps {
  value: EmployeeProfileFormState;
  users: UserWithAssignments[];
  warehouses: Warehouse[];
  disableUserLink: boolean;
  isEdit: boolean;
  canManageEmployment: boolean;
  onChange: Dispatch<SetStateAction<EmployeeProfileFormState>>;
}

const inputClassName =
  "h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]";

export function EmployeeProfileFields({
  value,
  users,
  warehouses,
  disableUserLink,
  isEdit,
  canManageEmployment,
  onChange,
}: EmployeeProfileFieldsProps) {
  const { t } = useTranslation();
  const labels = t.employeeManagement.fields;
  const statusLabels = t.employeeManagement.statusLabels as Record<
    string,
    string
  >;
  const employmentLabels = t.employeeManagement
    .employmentStatusLabels as Record<string, string>;

  const set = (field: keyof EmployeeProfileFormState, next: string) =>
    onChange((current) => ({ ...current, [field]: next }));

  return (
    <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label={labels.employeeCode}>
          <input
            required
            value={value.employee_code}
            onChange={(event) => set("employee_code", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={labels.fullName}>
          <input
            required
            value={value.full_name}
            onChange={(event) => set("full_name", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={labels.email}>
          <input
            type="email"
            value={value.email}
            onChange={(event) => set("email", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={labels.phone}>
          <input
            value={value.phone}
            onChange={(event) => set("phone", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={labels.jobTitle}>
          <input
            value={value.job_title}
            onChange={(event) => set("job_title", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={labels.department}>
          <input
            value={value.department}
            onChange={(event) => set("department", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={labels.workplace}>
          <select
            required
            value={value.workplace_warehouse_id}
            onChange={(event) =>
              set("workplace_warehouse_id", event.target.value)
            }
            className={inputClassName}
          >
            <option value="" disabled>
              {t.officeScope.selectWorkplace}
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} · {t.warehouses.types[warehouse.type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={labels.status}>
          <select
            value={value.status}
            onChange={(event) =>
              set("status", event.target.value as EmployeeProfileStatus)
            }
            className={inputClassName}
          >
            {Object.values(EmployeeProfileStatus).map((status) => (
              <option key={status} value={status}>
                {profileStatusLabel(status, statusLabels)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {labels.employmentTimeline}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {isEdit
              ? labels.employmentStatusChangeHint
              : labels.employmentCreateHint}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label={labels.employmentStatus}>
            <select
              value={value.employment_status}
              disabled={isEdit || !canManageEmployment}
              onChange={(event) => set("employment_status", event.target.value)}
              className={inputClassName}
            >
              {Object.values(EmployeeEmploymentStatus).map((status) => (
                <option key={status} value={status}>
                  {employmentLabels[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={labels.probationStartDate}>
            <input
              type="date"
              value={value.probation_start_date}
              disabled={!canManageEmployment}
              required={
                value.employment_status === EmployeeEmploymentStatus.PROBATION
              }
              onChange={(event) =>
                set("probation_start_date", event.target.value)
              }
              className={inputClassName}
            />
          </Field>
          <Field label={labels.probationEndDate}>
            <input
              type="date"
              value={value.probation_end_date}
              disabled={!canManageEmployment}
              onChange={(event) =>
                set("probation_end_date", event.target.value)
              }
              className={inputClassName}
            />
          </Field>
          <Field label={labels.officialStartDate}>
            <input
              type="date"
              value={value.official_start_date}
              disabled={!canManageEmployment}
              required={
                value.employment_status === EmployeeEmploymentStatus.OFFICIAL
              }
              onChange={(event) =>
                set("official_start_date", event.target.value)
              }
              className={inputClassName}
            />
          </Field>
          <Field label={labels.resignationDate}>
            <input
              type="date"
              value={value.resignation_date}
              disabled={!canManageEmployment}
              required={
                value.employment_status === EmployeeEmploymentStatus.RESIGNED
              }
              onChange={(event) => set("resignation_date", event.target.value)}
              className={inputClassName}
            />
          </Field>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <Field label={labels.notes}>
          <textarea
            value={value.notes}
            onChange={(event) => set("notes", event.target.value)}
            className="min-h-20 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
          />
        </Field>
        <Field label={labels.linkAccount}>
          <select
            value={value.user_id}
            disabled={disableUserLink}
            onChange={(event) => set("user_id", event.target.value)}
            className={inputClassName}
          >
            <option value="">{labels.unlinked}</option>
            {users
              .filter((user) => !user.is_deleted)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} - {user.email}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
