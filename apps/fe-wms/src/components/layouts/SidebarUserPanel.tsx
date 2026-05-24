"use client";

import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";

interface SidebarUserPanelProps {
  isCollapsed: boolean;
}

export default function SidebarUserPanel({
  isCollapsed,
}: SidebarUserPanelProps) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const permissions = useUserStore((s) => s.permissions);

  if (!user) return null;

  const initials =
    user.full_name
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const scopes = Object.keys(permissions);
  const isGlobal = scopes.includes("global");
  const roleName = isGlobal
    ? t.roles.ADMIN
    : scopes.length > 0
      ? t.roles.WAREHOUSE_STAFF
      : "";

  return (
    <div
      className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}
    >
      <div
        className="
          flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
          bg-[var(--color-brand-primary)] text-xs font-bold text-[#0A0A0F]
        "
        title={isCollapsed ? user.full_name : undefined}
      >
        {initials}
      </div>

      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {user.full_name}
          </p>
          {roleName && (
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {roleName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
