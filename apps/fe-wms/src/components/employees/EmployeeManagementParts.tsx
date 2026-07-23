"use client";

import { motion } from "framer-motion";
import {
    BriefcaseBusiness,
    ChevronRight,
    Edit3,
    MapPin,
    Trash2,
    UserCheck,
    UserX,
    type LucideIcon,
} from "lucide-react";
import { EmployeeProfileStatus } from "@bduck/shared-types";
import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import { profileStatusLabel } from "./employeeProfileFormTypes";

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getAvatarBg = (name: string) => {
    const colors = [
        "bg-[#0066cc10] text-[#0066cc]",
        "bg-[#257a3e10] text-[#257a3e]",
        "bg-[#93600010] text-[#936000]",
        "bg-[#7928ca10] text-[#7928ca]",
        "bg-[#ff007f10] text-[#ff007f]",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

/**
 * Mobile Native App Row Card Component
 */
export function EmployeeRowCard({
    profile,
    user,
    warehouse,
    canWrite,
    onViewDetails,
    onEdit,
    onDelete,
}: {
    profile: EmployeeProfile;
    user: UserWithAssignments | null | undefined;
    warehouse: Warehouse | undefined;
    canWrite: boolean;
    onViewDetails: (profile: EmployeeProfile) => void;
    onEdit: (profile: EmployeeProfile) => void;
    onDelete: (profile: EmployeeProfile) => void;
}) {
    const { t } = useTranslation();
    const labels = t.employeeManagement;
    const details = t.employeeManagement.detailSections;
    const statusLabels = t.employeeManagement.statusLabels as Record<string, string>;

    const initials = getInitials(profile.full_name);
    const avatarBg = getAvatarBg(profile.full_name);

    return (
        <motion.article
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onViewDetails(profile)}
            className="group relative flex flex-col gap-2.5 rounded-2xl border border-white/80 bg-white p-3.5 shadow-xs transition-all hover:border-[var(--color-brand-primary)] hover:shadow-sm active:scale-[0.98] cursor-pointer"
        >
            {/* Header: Avatar, Name, Code & Status */}
            <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-3">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-2xs ${avatarBg}`}
                    >
                        {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors">
                                {profile.full_name}
                            </h3>
                        </div>
                        <p className="mt-0.5 truncate text-xxs font-semibold font-mono text-[var(--color-brand-primary)]">
                            {profile.employee_code}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <StatusPill status={profile.status} labels={statusLabels} />
                    <ChevronRight
                        size={16}
                        className="text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-primary)] transition-transform group-hover:translate-x-0.5"
                    />
                </div>
            </div>

            {/* Middle Section: Job Title, Department, Warehouse */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f8fafc] p-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                    <BriefcaseBusiness size={13} className="text-[var(--color-text-muted)] shrink-0" />
                    <span className="truncate text-xxs text-[var(--color-text-secondary)]">
                        {[profile.job_title, profile.department].filter(Boolean).join(" / ") || details.notAssigned}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0 justify-end">
                    <MapPin size={13} className="text-[var(--color-text-muted)] shrink-0" />
                    <span className="truncate text-xxs font-semibold text-[var(--color-text-primary)]">
                        {warehouse?.name || profile.workplace_warehouse_id}
                    </span>
                </div>
            </div>

            {/* Footer Section: User Link & Quick Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="min-w-0">
                    {user ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-semibold text-[#257a3e]">
                            <UserCheck size={11} />
                            <span className="truncate max-w-[120px]">{user.username}</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                            <UserX size={11} />
                            {details.unlinkedStatus}
                        </span>
                    )}
                </div>

                {canWrite && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => onEdit(profile)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] shadow-2xs hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)] transition-all active:scale-95 cursor-pointer"
                            aria-label={labels.actions.edit}
                            title={labels.actions.edit}
                        >
                            <Edit3 size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(profile)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-100 bg-white text-[#b42318] shadow-2xs hover:bg-red-50 transition-all active:scale-95 cursor-pointer"
                            aria-label={labels.actions.delete}
                            title={labels.actions.delete}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </div>
        </motion.article>
    );
}

/**
 * High-Density Desktop Table Row Component
 */
export function EmployeeRow({
    profile,
    user,
    warehouse,
    canWrite,
    onViewDetails,
    onEdit,
    onDelete,
}: {
    profile: EmployeeProfile;
    user: UserWithAssignments | null | undefined;
    warehouse: Warehouse | undefined;
    canWrite: boolean;
    onViewDetails: (profile: EmployeeProfile) => void;
    onEdit: (profile: EmployeeProfile) => void;
    onDelete: (profile: EmployeeProfile) => void;
}) {
    const { t } = useTranslation();
    const labels = t.employeeManagement;
    const details = t.employeeManagement.detailSections;
    const statusLabels = t.employeeManagement.statusLabels as Record<string, string>;

    const initials = getInitials(profile.full_name);
    const avatarBg = getAvatarBg(profile.full_name);

    return (
        <motion.tr
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onViewDetails(profile)}
            className="border-t border-[var(--color-border-soft)] hover:bg-slate-50/60 transition-colors cursor-pointer group"
        >
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xxs font-bold ${avatarBg}`}
                    >
                        {initials}
                    </div>
                    <div className="grid gap-0.5">
                        <span className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors">
                            {profile.full_name}
                        </span>
                        <span className="text-xs font-mono text-[var(--color-brand-primary)]">
                            {profile.employee_code}
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-4 py-2.5 text-xs font-medium text-[var(--color-text-secondary)]">
                <span>
                    {[profile.job_title, profile.department].filter(Boolean).join(" / ") || "-"}
                </span>
            </td>
            <td className="px-4 py-2.5 text-xs font-medium text-[var(--color-text-secondary)]">
                <div className="grid gap-0.5">
                    <span>{profile.email || "-"}</span>
                    <span className="text-micro text-[var(--color-text-muted)]">
                        {profile.phone || "-"}
                    </span>
                </div>
            </td>
            <td className="px-4 py-2.5">
                <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-2.5 py-0.5 text-xxs font-semibold text-[var(--color-text-secondary)]">
                    {warehouse?.name || profile.workplace_warehouse_id}
                </span>
            </td>
            <td className="px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">
                {user ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-xxs font-semibold text-[#257a3e]">
                        <UserCheck size={11} />
                        {user.username}
                    </span>
                ) : (
                    <span className="text-xxs text-[var(--color-text-muted)]">{labels.fields.unlinked}</span>
                )}
            </td>
            <td className="px-4 py-2.5">
                <StatusPill status={profile.status} labels={statusLabels} />
            </td>
            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                {canWrite && (
                    <div className="flex justify-end gap-1.5">
                        <button
                            type="button"
                            onClick={() => onEdit(profile)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-brand-primary)] transition-all active:scale-95 cursor-pointer"
                            aria-label={labels.actions.edit}
                            title={labels.actions.edit}
                        >
                            <Edit3 size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(profile)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[#b42318] hover:bg-red-50 transition-all active:scale-95 cursor-pointer"
                            aria-label={labels.actions.delete}
                            title={labels.actions.delete}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </td>
        </motion.tr>
    );
}

export function MetricCard({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col justify-between min-w-0 rounded-2xl border border-white/80 bg-white p-2.5 sm:p-3 shadow-xs lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-subtle)] lg:shadow-none"
        >
            <div className="flex items-center justify-between gap-1">
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                    <Icon size={14} className="sm:hidden" />
                    <Icon size={17} className="hidden sm:block" />
                </span>
                <span className="text-lg sm:text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
                    {value}
                </span>
            </div>
            <div className="mt-1.5 min-w-0">
                <span
                    title={label}
                    className="block truncate text-[10px] md:text-xs font-semibold text-[var(--color-text-muted)] leading-tight"
                >
                    {label}
                </span>
            </div>
        </motion.div>
    );
}

function StatusPill({
    status,
    labels,
}: {
    status: EmployeeProfileStatus;
    labels?: Record<string, string>;
}) {
    const tone =
        status === EmployeeProfileStatus.ACTIVE
            ? "border-[var(--color-accent-success)] text-[var(--color-accent-success)] bg-emerald-50"
            : status === EmployeeProfileStatus.ON_LEAVE
                ? "border-[var(--color-accent-warning)] text-[var(--color-accent-warning)] bg-amber-50"
                : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)] bg-slate-100";
    return (
        <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xxs font-semibold ${tone}`}
        >
            {profileStatusLabel(status, labels)}
        </span>
    );
}

export function EmployeeSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-xs"
                >
                    <div className="flex items-center gap-3">
                        <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton variant="text" className="h-4 w-32" />
                            <Skeleton variant="text" className="h-3 w-20" />
                        </div>
                    </div>
                    <Skeleton variant="text" className="h-8 w-full rounded-xl" />
                </div>
            ))}
        </div>
    );
}
