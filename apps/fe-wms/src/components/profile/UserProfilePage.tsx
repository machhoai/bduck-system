"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EmployeeProfileStatus } from "@bduck/shared-types";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployeeProfile } from "@/hooks/useEmployeeProfiles";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation, type Language } from "@/lib/i18n";
import { MISC_COMPONENT_TEXT } from "@/lib/i18n/componentTranslations";
import { useUserStore } from "@/stores/useUserStore";
import { MFASetupModal } from "./MFASetupModal";

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
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "N/A";
  }
}

export default function UserProfilePage() {
  const { t, lang } = useTranslation();
  const misc = MISC_COMPONENT_TEXT[lang === "zh" ? "zh" : "vi"];
  const authUser = useUserStore((state) => state.user);
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

  const currentUser = users.find((user) => user.id === authUser?.id) || authUser;
  const assignments =
    currentUser && "assignments" in currentUser
      ? ((currentUser as { assignments?: any[] }).assignments || [])
      : [];
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  if (usersLoading || rolesLoading || warehousesLoading || profileLoading) {
    return (
      <div className="grid w-full gap-4 p-4">
        <div className="h-40 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]" />
        <div className="h-64 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]" />
      </div>
    );
  }

  if (!currentUser) return null;

  const workplace = profile
    ? warehouseById.get(profile.workplace_warehouse_id)
    : null;

  return (
    <div className="grid w-full gap-4 p-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="grid gap-4">
        <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] pb-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
                <UserRound size={22} />
              </span>
              <div className="grid gap-1">
                <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {currentUser.full_name}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {currentUser.username}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                currentUser.status === "ACTIVE"
                  ? "border-[var(--color-accent-success)] text-[var(--color-accent-success)]"
                  : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)]"
              }`}
            >
              {currentUser.status}
            </span>
          </div>

          <InfoLine icon={Mail} label="Email" value={currentUser.email} />
          <InfoLine
            icon={IdCard}
            label="Mã tài khoản nhân viên"
            value={currentUser.employee_id}
          />
          <InfoLine
            icon={ShieldCheck}
            label="Ngày tạo tài khoản"
            value={formatDate(currentUser.created_at, lang)}
          />
        </div>

        <button
          type="button"
          disabled={authLoading}
          onClick={() => resetPassword(currentUser.email)}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        >
          {t.profile.changePassword || "Đổi mật khẩu"}
        </button>

        <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck
              className={`h-6 w-6 ${
                currentUser.mfa_enabled ? "text-green-500" : "text-gray-400"
              }`}
            />
            <div className="grid flex-1 gap-1">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {misc.mfa2fa}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {currentUser.mfa_enabled ? misc.mfaLinked : misc.mfaNotSetup}
              </span>
            </div>
            {!currentUser.mfa_enabled ? (
              <button
                type="button"
                onClick={() => setIsMfaModalOpen(true)}
                className="h-8 rounded-full bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white transition-all active:scale-95"
              >
                {misc.link}
              </button>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase text-green-700">
                {misc.enabled}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
          <div className="grid gap-1 border-b border-[var(--color-border-soft)] pb-3">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Hồ sơ nhân sự
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Nơi làm việc được lấy từ bảng profile, không lấy từ phạm vi quyền
              warehouse của tài khoản.
            </p>
          </div>

          {profileError && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-accent-error)] p-3 text-sm text-[var(--color-accent-error)]">
              {profileError}
            </div>
          )}

          {profile ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoTile
                icon={IdCard}
                label="Mã nhân viên"
                value={profile.employee_code}
              />
              <InfoTile
                icon={BriefcaseBusiness}
                label="Chức danh"
                value={profile.job_title || "-"}
              />
              <InfoTile
                icon={WarehouseIcon}
                label="Nơi làm việc"
                value={workplace?.name || profile.workplace_warehouse_id}
              />
              <InfoTile
                icon={Phone}
                label="Điện thoại"
                value={profile.phone || "-"}
              />
              <InfoTile
                icon={Mail}
                label="Email hồ sơ"
                value={profile.email || "-"}
              />
              <InfoTile
                icon={ShieldCheck}
                label="Trạng thái hồ sơ"
                value={profileStatusLabel(profile.status)}
              />
            </div>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] p-4 text-center">
              <div className="grid gap-2">
                <IdCard
                  size={38}
                  className="mx-auto text-[var(--color-text-muted)]"
                />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Chưa có hồ sơ nhân viên
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Admin cần tạo profile và liên kết với tài khoản này.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
          <div className="grid gap-1 border-b border-[var(--color-border-soft)] pb-3">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t.profile.managementScope} &amp; {t.profile.roles}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Phần này là phạm vi quyền thao tác trong hệ thống.
            </p>
          </div>

          {assignments.length === 0 ? (
            <div className="grid min-h-32 place-items-center text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {t.profile.noRoles}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {assignments.map((assignment) => {
                const role = roles.find((item) => item.id === assignment.role_id);
                const warehouse = assignment.warehouse_id
                  ? warehouses.find((item) => item.id === assignment.warehouse_id)
                  : null;

                return (
                  <div
                    key={assignment.id}
                    className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {warehouse ? warehouse.name : t.profile.globalScope}
                      </span>
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
                          Unknown role
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {assignment.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <MFASetupModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
      />
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
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
        <Icon size={17} />
      </span>
      <div className="grid gap-1">
        <span className="text-xs uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="text-sm text-[var(--color-text-primary)]">{value}</span>
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
    <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)]">
        <Icon size={17} />
      </span>
      <div className="grid gap-1">
        <span className="text-xs uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="break-words text-sm font-semibold text-[var(--color-text-primary)]">
          {value}
        </span>
      </div>
    </div>
  );
}

function profileStatusLabel(status: EmployeeProfileStatus) {
  const labels: Record<string, string> = {
    ACTIVE: "Đang làm việc",
    INACTIVE: "Ngừng làm việc",
    ON_LEAVE: "Tạm nghỉ",
  };
  return labels[status] || status;
}
