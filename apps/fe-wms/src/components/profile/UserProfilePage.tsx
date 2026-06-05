"use client";

import { useUserStore } from "@/stores/useUserStore";
import { useUsers } from "@/hooks/useUsers";
import { useRoles } from "@/hooks/useRoles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation, type Language } from "@/lib/i18n";
import { useState } from "react";
import { MFASetupModal } from "./MFASetupModal";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

function formatDate(date: Date | null, lang: Language) {
  if (!date) return "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function UserProfilePage() {
  const { t, lang } = useTranslation();
  const authUser = useUserStore((s) => s.user);
  const { resetPassword, isLoading: authLoading } = useAuth();
  const { users, isLoading: usersLoading } = useUsers();
  const { roles, isLoading: rolesLoading } = useRoles();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);

  // Show a simple skeleton when loading
  if (usersLoading || rolesLoading || warehousesLoading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4">
        <div className="h-40 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]" />
        <div className="h-64 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]" />
      </div>
    );
  }

  // Find the complete user object including assignments
  const currentUser = users.find((u) => u.id === authUser?.id) || authUser;
  if (!currentUser) {
    return null; // or an error state
  }

  const assignments = "assignments" in currentUser ? currentUser.assignments : [];

  return (
    <div className="flex w-full flex-col gap-4 p-4 lg:flex-row">
      {/* Left Column: General Info */}
      <div className="flex flex-col gap-3 lg:w-1/3">
        <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border-soft)] pb-2">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t.profile.generalInfo}
            </h2>
            <span
              className={`rounded-[var(--radius-xs)] px-1.5 py-1 text-xs font-bold uppercase ${
                currentUser.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {currentUser.status === "ACTIVE" ? t.profile.active : t.profile.inactive}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col">
              <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.users.fullName}
              </span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {currentUser.full_name}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.profile.employeeId}
              </span>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                {currentUser.employee_id}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.users.username}
              </span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {currentUser.username}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.profile.email}
              </span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {currentUser.email}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.profile.joinDate}
              </span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {currentUser.created_at
                  ? formatDate(currentUser.created_at, lang)
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Action: Change Password */}
        <button
          type="button"
          disabled={authLoading}
          onClick={() => resetPassword(currentUser.email)}
          className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        >
          {t.profile.changePassword || "Đổi mật khẩu"}
        </button>

        {/* Action: Google Authenticator */}
        <div className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] p-4">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className={`w-6 h-6 ${currentUser.mfa_enabled ? 'text-green-500' : 'text-gray-400'}`} />
            <div className="flex flex-col flex-1">
              <span className="text-sm font-semibold text-gray-900">Xác thực 2 lớp (2FA)</span>
              <span className="text-xs text-gray-500">
                {currentUser.mfa_enabled ? "Đã liên kết Google Authenticator" : "Chưa thiết lập"}
              </span>
            </div>
            {!currentUser.mfa_enabled && (
              <button
                onClick={() => setIsMfaModalOpen(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                Liên kết
              </button>
            )}
            {currentUser.mfa_enabled && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-md">
                Đã bật
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Roles & Scopes */}
      <div className="flex flex-col gap-3 lg:flex-1">
        <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
          <div className="mb-4 border-b border-[var(--color-border-soft)] pb-2">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t.profile.managementScope} &amp; {t.profile.roles}
            </h2>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {t.profile.noRoles}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {assignments.map((assignment) => {
                const role = roles.find((r) => r.id === assignment.role_id);
                const warehouse = assignment.warehouse_id
                  ? warehouses.find((w) => w.id === assignment.warehouse_id)
                  : null;

                return (
                  <div
                    key={assignment.id}
                    className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {warehouse ? warehouse.name : t.profile.globalScope}
                      </span>
                      {role ? (
                        <span
                          className="rounded-[var(--radius-xs)] px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${role.color}20`,
                            color: role.color,
                          }}
                        >
                          {role.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          Unknown Role
                        </span>
                      )}
                    </div>
                    {!warehouse && (
                      <span className="text-micro text-[var(--color-text-muted)]">
                        {t.profile.globalScope} - {t.profile.warehouseScope}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MFASetupModal isOpen={isMfaModalOpen} onClose={() => setIsMfaModalOpen(false)} />
    </div>
  );
}
