"use client";

import { motion } from "framer-motion";
import { Edit3, Trash2, type LucideIcon } from "lucide-react";
import { EmployeeProfileStatus } from "@bduck/shared-types";
import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { profileStatusLabel } from "./employeeProfileFormTypes";

export function EmployeeRow({
  profile,
  user,
  warehouse,
  canWrite,
  onEdit,
  onDelete,
}: {
  profile: EmployeeProfile;
  user: UserWithAssignments | null | undefined;
  warehouse: Warehouse | undefined;
  canWrite: boolean;
  onEdit: (profile: EmployeeProfile) => void;
  onDelete: (profile: EmployeeProfile) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-t border-[var(--color-border-soft)]"
    >
      <td className="px-4 py-3">
        <div className="grid gap-1">
          <span className="font-semibold text-[var(--color-text-primary)]">
            {profile.full_name}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {profile.employee_code}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {[profile.job_title, profile.department]
              .filter(Boolean)
              .join(" / ") || "-"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
        <div className="grid gap-1">
          <span>{profile.email || "-"}</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {profile.phone || "-"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {warehouse?.name || profile.workplace_warehouse_id}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
        {user ? (
          <div className="grid gap-1">
            <span>{user.username}</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {user.email}
            </span>
          </div>
        ) : (
          <span className="text-[var(--color-text-muted)]">Chưa liên kết</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={profile.status} />
      </td>
      <td className="px-4 py-3">
        {canWrite && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(profile)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
              aria-label="Sửa"
            >
              <Edit3 size={16} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(profile)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)]"
              aria-label="Xóa"
            >
              <Trash2 size={16} />
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
        <Icon size={18} />
      </span>
      <div className="grid gap-1">
        <span className="text-2xl font-semibold text-[var(--color-text-primary)]">
          {value}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

function StatusPill({ status }: { status: EmployeeProfileStatus }) {
  const tone =
    status === EmployeeProfileStatus.ACTIVE
      ? "border-[var(--color-accent-success)] text-[var(--color-accent-success)] bg-emerald-50"
      : status === EmployeeProfileStatus.ON_LEAVE
        ? "border-[var(--color-accent-warning)] text-[var(--color-accent-warning)] bg-amber-50"
        : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)] bg-white";
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {profileStatusLabel(status)}
    </span>
  );
}

export function EmployeeSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-4 md:grid-cols-[1fr_1fr_160px]"
        >
          <div className="grid gap-2">
            <Skeleton variant="text" className="h-4 w-48" />
            <Skeleton variant="text" className="h-3 w-32" />
          </div>
          <Skeleton variant="text" className="h-4 w-64" />
          <Skeleton variant="text" className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
