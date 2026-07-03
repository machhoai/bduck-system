"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  IdCard,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  EmployeeProfileStatus,
  UserWarehouseRole,
} from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployeeProfile } from "@/hooks/useEmployeeProfiles";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation, type Language } from "@/lib/i18n";
import { MISC_COMPONENT_TEXT } from "@/lib/i18n/componentTranslations";
import { useUserStore } from "@/stores/useUserStore";
import { MFASetupModal } from "./MFASetupModal";

type ProfileCopy = {
  accountOverview: string;
  generalInfo: string;
  employeeId: string;
  employeeCode: string;
  email: string;
  profileEmail: string;
  phone: string;
  jobTitle: string;
  workplace: string;
  status: string;
  profileStatus: string;
  joinDate: string;
  activeRoles: string;
  scopedWarehouses: string;
  security: string;
  mfaEnabledDescription: string;
  mfaDisabledDescription: string;
  employeeProfile: string;
  employeeProfileDescription: string;
  managementScope: string;
  roles: string;
  globalScope: string;
  warehouseScope: string;
  noRoles: string;
  noRolesHint: string;
  noEmployeeProfile: string;
  noEmployeeProfileHint: string;
  unknownRole: string;
  validFrom: string;
  validUntil: string;
  changePassword: string;
  profileStatuses: Record<string, string>;
};

function hasAssignments(
  user: unknown,
): user is { assignments: UserWarehouseRole[] } {
  return (
    typeof user === "object" &&
    user !== null &&
    "assignments" in user &&
    Array.isArray((user as { assignments?: unknown }).assignments)
  );
}

function activeUniqueAssignments(assignments: UserWarehouseRole[]) {
  const byScopeRole = new Map<string, UserWarehouseRole>();

  assignments
    .filter((assignment) => assignment.is_active)
    .forEach((assignment) => {
      byScopeRole.set(
        `${assignment.warehouse_id || "global"}:${assignment.role_id}`,
        assignment,
      );
    });

  return Array.from(byScopeRole.values());
}

function formatDate(dateVal: unknown, lang: Language) {
  if (!dateVal) return "-";
  try {
    let date: Date;
    if (
      typeof dateVal === "object" &&
      dateVal !== null &&
      "toDate" in dateVal &&
      typeof (dateVal as { toDate: () => Date }).toDate === "function"
    ) {
      date = (dateVal as { toDate: () => Date }).toDate();
    } else if (
      typeof dateVal === "object" &&
      dateVal !== null &&
      "_seconds" in dateVal
    ) {
      date = new Date((dateVal as { _seconds: number })._seconds * 1000);
    } else {
      date = new Date(dateVal as string | number | Date);
    }

    if (Number.isNaN(date.getTime())) return "N/A";
    return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "N/A";
  }
}

export default function UserProfilePage() {
  const { t, lang } = useTranslation();
  const copy = t.profile as typeof t.profile & ProfileCopy;
  const misc = MISC_COMPONENT_TEXT[lang === "zh" ? "zh" : "vi"];
  const authUser = useUserStore((state) => state.user);
  const storeAssignments = useUserStore((state) => state.roleAssignments);
  const { resetPassword, isLoading: authLoading } = useAuth();
  const { users, isLoading: usersLoading } = useUsers();
  const { roles, isLoading: rolesLoading } = useRoles();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const {
    profile,
    isLoading: profileLoading,
    error: profileError,
  } = useMyEmployeeProfile();
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);

  const currentUser =
    users.find((user) => user.id === authUser?.id) || authUser;
  const userAssignments: UserWarehouseRole[] =
    currentUser && hasAssignments(currentUser)
      ? currentUser.assignments
      : storeAssignments;
  const assignments = activeUniqueAssignments(userAssignments);

  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const uniqueWarehouseCount = useMemo(
    () =>
      new Set(
        assignments
          .map((assignment) => assignment.warehouse_id)
          .filter(Boolean),
      ).size,
    [assignments],
  );

  if (usersLoading || rolesLoading || warehousesLoading || profileLoading) {
    return <ProfileSkeleton />;
  }

  if (!currentUser) return null;

  const workplace = profile
    ? warehouseById.get(profile.workplace_warehouse_id)
    : null;
  const accountStatusLabel =
    t.users.statuses[currentUser.status] || currentUser.status;

  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white">
        <div className="grid gap-5 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] text-white">
              <UserRound size={30} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {copy.accountOverview}
              </p>
              <h1 className="mt-1 truncate font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text-primary)]">
                {currentUser.full_name}
              </h1>
              <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                @{currentUser.username} · {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusPill active={currentUser.status === "ACTIVE"}>
              {accountStatusLabel}
            </StatusPill>
            <StatusPill active={Boolean(currentUser.mfa_enabled)}>
              {currentUser.mfa_enabled ? misc.mfaLinked : misc.mfaNotSetup}
            </StatusPill>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <MetricTile
            icon={ShieldCheck}
            label={copy.activeRoles}
            value={String(assignments.length)}
          />
          <MetricTile
            icon={WarehouseIcon}
            label={copy.scopedWarehouses}
            value={
              assignments.some((assignment) => !assignment.warehouse_id)
                ? copy.globalScope
                : String(uniqueWarehouseCount)
            }
          />
          <MetricTile
            icon={CalendarClock}
            label={copy.joinDate}
            value={formatDate(currentUser.created_at, lang)}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-5">
          <Panel title={copy.generalInfo}>
            <div className="space-y-4">
              <InfoLine
                icon={Mail}
                label={copy.email}
                value={currentUser.email}
              />
              <InfoLine
                icon={IdCard}
                label={copy.employeeId}
                value={currentUser.employee_id}
              />
              <InfoLine
                icon={BadgeCheck}
                label={copy.status}
                value={accountStatusLabel}
              />
            </div>
          </Panel>

          <Panel title={copy.security}>
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
                  currentUser.mfa_enabled
                    ? "bg-[var(--color-accent-success)]/10 text-[var(--color-accent-success)]"
                    : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
                }`}
              >
                <ShieldCheck size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {misc.mfa2fa}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {currentUser.mfa_enabled
                    ? copy.mfaEnabledDescription
                    : copy.mfaDisabledDescription}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {!currentUser.mfa_enabled && (
                <button
                  type="button"
                  onClick={() => setIsMfaModalOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition-all active:scale-95"
                >
                  <ShieldCheck size={16} />
                  {misc.link}
                </button>
              )}
              <button
                type="button"
                disabled={authLoading}
                onClick={() => resetPassword(currentUser.email)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
              >
                <KeyRound size={16} />
                {copy.changePassword}
              </button>
            </div>
          </Panel>
        </section>

        <section className="space-y-5">
          <Panel
            title={copy.employeeProfile}
            subtitle={copy.employeeProfileDescription}
          >
            {profileError && (
              <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-accent-error)] p-3 text-sm text-[var(--color-accent-error)]">
                {profileError}
              </div>
            )}

            {profile ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <InfoTile
                  icon={IdCard}
                  label={copy.employeeCode}
                  value={profile.employee_code}
                />
                <InfoTile
                  icon={BriefcaseBusiness}
                  label={copy.jobTitle}
                  value={profile.job_title || "-"}
                />
                <InfoTile
                  icon={WarehouseIcon}
                  label={copy.workplace}
                  value={workplace?.name || profile.workplace_warehouse_id}
                />
                <InfoTile
                  icon={Phone}
                  label={copy.phone}
                  value={profile.phone || "-"}
                />
                <InfoTile
                  icon={Mail}
                  label={copy.profileEmail}
                  value={profile.email || "-"}
                />
                <InfoTile
                  icon={BadgeCheck}
                  label={copy.profileStatus}
                  value={profileStatusLabel(
                    profile.status,
                    copy.profileStatuses,
                  )}
                />
              </div>
            ) : (
              <EmptyState
                icon={IdCard}
                title={copy.noEmployeeProfile}
                hint={copy.noEmployeeProfileHint}
              />
            )}
          </Panel>

          <Panel title={`${copy.managementScope} & ${copy.roles}`}>
            {assignments.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={copy.noRoles}
                hint={copy.noRolesHint}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {assignments.map((assignment) => {
                  const role = roles.find(
                    (item) => item.id === assignment.role_id,
                  );
                  const warehouse = assignment.warehouse_id
                    ? warehouses.find(
                        (item) => item.id === assignment.warehouse_id,
                      )
                    : null;

                  return (
                    <div
                      key={assignment.id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {warehouse ? warehouse.name : copy.globalScope}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {assignment.warehouse_id
                              ? copy.warehouseScope
                              : copy.globalScope}
                          </p>
                        </div>
                        {role ? (
                          <span
                            className="rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: `${role.color}20`,
                              color: role.color,
                            }}
                          >
                            {role.name}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {copy.unknownRole}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--color-text-secondary)]">
                        <span>
                          {copy.validFrom}: {assignment.valid_from}
                        </span>
                        <span>
                          {copy.validUntil}: {assignment.valid_until || "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>
      </div>

      <MFASetupModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
      />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-5">
        <div className="flex items-center gap-4">
          <Skeleton
            variant="rect"
            className="h-16 w-16 rounded-[var(--radius-md)]"
          />
          <div className="flex-1 space-y-3">
            <Skeleton variant="text" className="h-4 w-32" />
            <Skeleton variant="text" className="h-7 w-64" />
            <Skeleton variant="text" className="h-4 w-80" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Skeleton variant="rect" className="h-72 rounded-[var(--radius-lg)]" />
        <Skeleton variant="rect" className="h-72 rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-5">
      <div className="mb-4 border-b border-[var(--color-border-soft)] pb-3">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-white p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <span className="block text-xs uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm text-[var(--color-text-primary)]">
          {value}
        </span>
      </div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-white text-[var(--color-brand-primary)]">
        <Icon size={17} />
      </span>
      <div className="mt-3 min-w-0">
        <span className="block text-xs uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="mt-1 block break-words text-sm font-semibold text-[var(--color-text-primary)]">
          {value}
        </span>
      </div>
    </div>
  );
}

function StatusPill({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const tone = active
    ? "border-[var(--color-accent-success)] bg-[var(--color-accent-success)]/10 text-[var(--color-accent-success)]"
    : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-muted)]";

  return (
    <span
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold ${tone}`}
    >
      {children}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="grid min-h-44 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 text-center">
      <div>
        <Icon size={36} className="mx-auto text-[var(--color-text-muted)]" />
        <h3 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {hint}
        </p>
      </div>
    </div>
  );
}

function profileStatusLabel(
  status: EmployeeProfileStatus,
  labels: Record<string, string>,
) {
  return labels[status] || status;
}
