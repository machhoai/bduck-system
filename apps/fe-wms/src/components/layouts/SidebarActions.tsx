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
            flex h-6 w-6 shrink-0 items-center justify-center rounded-full absolute top-0 left-full bg-white translate-x-1/2 border-[var(--color-border-subtle)] border text-[var(--color-text-primary)] transition-all duration-200 cursor-pointer
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
          flex h-10 shrink-0 items-center justify-center rounded-lg flex-1
          text-[var(--color-text-muted)] transition-all duration-200
          hover:bg-[var(--color-accent-error)]/10 hover:text-[var(--color-accent-error)]
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
