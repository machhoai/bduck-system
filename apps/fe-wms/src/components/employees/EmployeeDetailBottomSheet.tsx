"use client";

import { useEffect, useState } from "react";
import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
} from "@bduck/shared-types";
import {
  BriefcaseBusiness,
  Calendar,
  Edit3,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import { profileStatusLabel } from "./employeeProfileFormTypes";

interface EmployeeDetailBottomSheetProps {
  isOpen: boolean;
  profile: EmployeeProfile | null;
  user?: UserWithAssignments | null;
  warehouse?: Warehouse | null;
  canWrite: boolean;
  canManageEmployment: boolean;
  onClose: () => void;
  onEdit: (profile: EmployeeProfile) => void;
  onDelete: (profile: EmployeeProfile) => void;
  onManageEmployment: (profile: EmployeeProfile) => void;
}

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

const formatDate = (dateValue: unknown) => {
  if (!dateValue) return "---";
  const date = new Date(dateValue as string | number | Date);
  if (Number.isNaN(date.getTime())) return "---";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
};

export function EmployeeDetailBottomSheet({
  isOpen,
  profile,
  user,
  warehouse,
  canWrite,
  canManageEmployment,
  onClose,
  onEdit,
  onDelete,
  onManageEmployment,
}: EmployeeDetailBottomSheetProps) {
  const { t } = useTranslation();
  const labels = t.employeeManagement;
  const details = t.employeeManagement.detailSections;
  const statusLabels = t.employeeManagement.statusLabels as Record<
    string,
    string
  >;
  const employmentStatusLabels = t.employeeManagement
    .employmentStatusLabels as Record<string, string>;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!profile) return null;

  const initials = getInitials(profile.full_name);
  const avatarBg = getAvatarBg(profile.full_name);

  const detailContent = (
    <div className="flex flex-col gap-4 text-sm text-[var(--color-text-primary)]">
      {/* Header Hero Profile Summary */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-gradient-to-br from-white to-[var(--color-surface-card)] p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-xs ${avatarBg}`}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold text-[var(--color-text-primary)]">
                {profile.full_name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full bg-[var(--color-brand-primary-muted)] px-2 py-0.5 text-xxs font-semibold tabular-nums text-[var(--color-brand-primary)]">
                  {profile.employee_code}
                </span>
                <StatusBadge status={profile.status} labels={statusLabels} />
              </div>
            </div>
          </div>

          {(canWrite || canManageEmployment) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canManageEmployment && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onManageEmployment(profile);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-brand-primary)] shadow-2xs hover:bg-[var(--color-brand-primary-muted)] transition-all active:scale-95 cursor-pointer"
                  title={labels.actions.manageEmployment}
                  aria-label={labels.actions.manageEmployment}
                >
                  <Calendar size={15} />
                </button>
              )}
              {canWrite && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(profile);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] shadow-2xs hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)] transition-all active:scale-95 cursor-pointer"
                    title={labels.actions.edit}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDelete(profile);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-[#b42318] shadow-2xs hover:bg-red-50 transition-all active:scale-95 cursor-pointer"
                    title={labels.actions.delete}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Thông tin công việc */}
      <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
          <BriefcaseBusiness
            size={15}
            className="text-[var(--color-brand-primary)]"
          />
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            {details.jobInfo}
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-xxs font-medium text-[var(--color-text-muted)]">
              {labels.fields.jobTitle}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
              {profile.job_title || details.notUpdated}
            </p>
          </div>
          <div>
            <p className="text-xxs font-medium text-[var(--color-text-muted)]">
              {labels.fields.department}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
              {profile.department || details.notUpdated}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xxs font-medium text-[var(--color-text-muted)]">
              {labels.fields.workplace}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
              <MapPin
                size={13}
                className="text-[var(--color-brand-primary)] shrink-0"
              />
              <span>{warehouse?.name || profile.workplace_warehouse_id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
          <Calendar size={15} className="text-[var(--color-brand-primary)]" />
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            {details.employmentInfo}
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <DetailValue
            label={labels.fields.employmentStatus}
            value={
              employmentStatusLabels[
                profile.employment_status ??
                  EmployeeEmploymentStatus.UNSPECIFIED
              ]
            }
          />
          <DetailValue
            label={labels.fields.probationStartDate}
            value={formatDate(profile.probation_start_date)}
          />
          <DetailValue
            label={labels.fields.probationEndDate}
            value={formatDate(profile.probation_end_date)}
          />
          <DetailValue
            label={labels.fields.officialStartDate}
            value={formatDate(profile.official_start_date)}
          />
          <DetailValue
            label={labels.fields.resignationDate}
            value={formatDate(profile.resignation_date)}
          />
        </div>
      </div>

      {/* Thông tin liên hệ */}
      <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
          <Mail size={15} className="text-[var(--color-brand-primary)]" />
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            {details.contactInfo}
          </h4>
        </div>
        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#f8fafc] p-2">
            <Mail
              size={14}
              className="text-[var(--color-text-muted)] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xxs text-[var(--color-text-muted)]">
                {labels.fields.email}
              </p>
              <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
                {profile.email ? (
                  <a
                    href={`mailto:${profile.email}`}
                    className="hover:underline"
                  >
                    {profile.email}
                  </a>
                ) : (
                  details.noEmail
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#f8fafc] p-2">
            <Phone
              size={14}
              className="text-[var(--color-text-muted)] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xxs text-[var(--color-text-muted)]">
                {labels.fields.phone}
              </p>
              <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
                {profile.phone ? (
                  <a href={`tel:${profile.phone}`} className="hover:underline">
                    {profile.phone}
                  </a>
                ) : (
                  details.noPhone
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tài khoản hệ thống */}
      <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={15}
              className="text-[var(--color-brand-primary)]"
            />
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
              {details.systemAccount}
            </h4>
          </div>
          {user ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xxs font-semibold text-[#257a3e]">
              <UserCheck size={12} />
              {details.linkedStatus}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xxs font-semibold text-[var(--color-text-muted)]">
              <UserX size={12} />
              {details.unlinkedStatus}
            </span>
          )}
        </div>

        {user ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-xxs font-medium text-[var(--color-text-muted)]">
                {details.username}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
                {user.username}
              </p>
            </div>
            <div>
              <p className="text-xxs font-medium text-[var(--color-text-muted)]">
                {details.systemEmail}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-text-primary)]">
                {user.email}
              </p>
            </div>
          </div>
        ) : (
          <p className="py-1 text-xs text-[var(--color-text-muted)]">
            {details.unlinkedAccountDesc}
          </p>
        )}
      </div>

      {/* Ghi chú & Nhật ký */}
      <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
          <Calendar size={15} className="text-[var(--color-brand-primary)]" />
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            {details.notesAudit}
          </h4>
        </div>
        <div className="space-y-2 pt-1">
          {profile.notes && (
            <div>
              <p className="text-xxs font-medium text-[var(--color-text-muted)]">
                {labels.fields.notes}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {profile.notes}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-xxs font-medium text-[var(--color-text-muted)]">
                {details.createdAt}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
                {formatDate(profile.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xxs font-medium text-[var(--color-text-muted)]">
                {details.updatedAt}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
                {formatDate(profile.updated_at)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet
        title={labels.detailTitle}
        isOpen={isOpen}
        onClose={onClose}
        defaultSnap="full"
      >
        <div className="py-2 px-1 pb-12">{detailContent}</div>
      </BottomSheet>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-all duration-300"
        onClick={onClose}
      />
      <div className="relative z-50 flex max-h-[90vh] w-full max-w-[540px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
              <IdCard size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {labels.detailTitle}
              </h2>
              <p className="text-xxs text-[var(--color-text-muted)]">
                {details.code.replace("{code}", profile.employee_code)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{detailContent}</div>
      </div>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xxs font-medium text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
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
