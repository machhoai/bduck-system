"use client";

import type { Dispatch, SetStateAction } from "react";
import {
    EmployeeEmploymentStatus,
    EmployeeProfileStatus,
} from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import {
    Briefcase,
    Building2,
    Calendar,
    FileText,
    IdCard,
    User,
    UserCheck,
} from "lucide-react";
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
    "h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-xs text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] disabled:bg-slate-50 disabled:text-slate-400";

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

    const isProbationRequired =
        value.employment_status === EmployeeEmploymentStatus.PROBATION;
    const isOfficialRequired =
        value.employment_status === EmployeeEmploymentStatus.OFFICIAL;
    const isResignedRequired =
        value.employment_status === EmployeeEmploymentStatus.RESIGNED;

    return (
        <section className="flex flex-col gap-4">
            {/* Card 1: Thông tin Cá nhân & Công việc Cơ bản */}
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-xs">
                <div className="mb-3.5 flex items-center justify-between border-b border-[var(--color-border-soft)] pb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                            <User size={15} />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                Thông tin cá nhân & Công việc
                            </h3>
                        </div>
                    </div>
                    <span className="rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-xxs font-bold text-amber-700">
                        * Có các trường bắt buộc
                    </span>
                </div>

                <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4">
                    <Field label={labels.employeeCode} required>
                        <input
                            required
                            value={value.employee_code}
                            onChange={(event) => set("employee_code", event.target.value)}
                            className={inputClassName}
                        />
                    </Field>
                    <Field label={labels.fullName} required>
                        <input
                            required
                            value={value.full_name}
                            onChange={(event) => set("full_name", event.target.value)}
                            className={inputClassName}
                        />
                    </Field>
                    <Field label={labels.workplace} required>
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
                </div>
            </div>

            {/* Card 2: Diễn biến Lao động & Mốc thời gian */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 shadow-2xs">
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-blue-100/80 pb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <Briefcase size={15} />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                {labels.employmentTimeline}
                            </h3>
                            <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
                                {isEdit
                                    ? labels.employmentStatusChangeHint
                                    : labels.employmentCreateHint}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-5">
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
                    <Field
                        label={labels.probationStartDate}
                        required={isProbationRequired}
                    >
                        <input
                            type="date"
                            value={value.probation_start_date}
                            disabled={!canManageEmployment}
                            required={isProbationRequired}
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
                    <Field label={labels.officialStartDate} required={isOfficialRequired}>
                        <input
                            type="date"
                            value={value.official_start_date}
                            disabled={!canManageEmployment}
                            required={isOfficialRequired}
                            onChange={(event) =>
                                set("official_start_date", event.target.value)
                            }
                            className={inputClassName}
                        />
                    </Field>
                    <Field label={labels.resignationDate} required={isResignedRequired}>
                        <input
                            type="date"
                            value={value.resignation_date}
                            disabled={!canManageEmployment}
                            required={isResignedRequired}
                            onChange={(event) => set("resignation_date", event.target.value)}
                            className={inputClassName}
                        />
                    </Field>
                </div>
            </div>

            {/* Card 3: Ghi chú & Liên kết Tài khoản hệ thống */}
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-xs">
                <div className="grid gap-3.5 md:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
                    <Field label={labels.notes}>
                        <textarea
                            value={value.notes}
                            onChange={(event) => set("notes", event.target.value)}
                            className="min-h-20 w-full rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-xs outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]"
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
            </div>
        </section>
    );
}

function Field({
    label,
    required = false,
    badge,
    children,
}: {
    label: string;
    required?: boolean;
    badge?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    {label}
                    {required ? <span className="ml-1 text-red-500 font-bold">*</span> : null}
                </span>
                {badge && (
                    <span className="text-xxs font-medium text-[var(--color-text-muted)] bg-slate-100 px-1.5 py-0.5 rounded">
                        {badge}
                    </span>
                )}
            </div>
            {children}
        </label>
    );
}
