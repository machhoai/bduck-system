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
          flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]
          bg-white text-xs font-semibold text-[var(--color-surface-nav)]
        "
        title={isCollapsed ? user.full_name : undefined}
      >
        {initials}
      </div>

      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-normal text-white">
            {user.full_name}
          </p>
          {roleName && (
            <p className="truncate text-xs text-white/55">
              {roleName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
