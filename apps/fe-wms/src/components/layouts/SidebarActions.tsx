"use client";

import { ChevronLeft, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../lib/i18n";
import { useSidebarStore } from "../../stores/useSidebarStore";
import LanguageSwitcher from "./LanguageSwitcher";

interface SidebarActionsProps {
  isCollapsed?: boolean;
  showCollapse?: boolean;
}

export default function SidebarActions({
  isCollapsed = false,
  showCollapse = false,
}: SidebarActionsProps) {
  const { t } = useTranslation();
  const { logout, isLoading } = useAuth();
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const ToggleIcon = isCollapsed ? ChevronRight : ChevronLeft;

  return (
    <div
      className={`
        flex gap-1.5 relative
        ${isCollapsed ? "flex-col items-center" : "items-center justify-between"}
      `}
    >
      <LanguageSwitcher />

      {showCollapse && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="
            absolute left-full top-0 flex h-7 w-7 shrink-0 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] transition-all duration-200 active:scale-95
          "
          title={isCollapsed ? t.sidebar.expand : t.sidebar.collapse}
          aria-label={isCollapsed ? t.sidebar.expand : t.sidebar.collapse}
        >
          <ToggleIcon size={18} strokeWidth={1.7} />
        </button>
      )}

      {!isCollapsed && (
        <button
          type="button"
          onClick={logout}
          disabled={isLoading}
          className={`
          flex h-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] flex-1
          text-white/65 transition-all duration-200 active:scale-95
          hover:bg-white/10 hover:text-white
          disabled:cursor-not-allowed disabled:opacity-40
        `}
          title={t.user.logout}
          aria-label={t.user.logout}
        >
          <LogOut size={18} strokeWidth={1.7} className="shrink-0" />
        </button>
      )}
    </div>
  );
}
