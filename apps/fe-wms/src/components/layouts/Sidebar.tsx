"use client";

import { Warehouse } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";
import { useSidebarStore } from "../../stores/useSidebarStore";
import { getVisibleMenuItems, menuItems } from "../../config/menuConfig";
import SidebarActions from "./SidebarActions";
import SidebarMenuItem from "./SidebarMenuItem";
import SidebarUserPanel from "./SidebarUserPanel";

export default function Sidebar() {
  const { t } = useTranslation();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const hasPermission = useUserStore((s) => s.hasPermission);
  const visibleItems = getVisibleMenuItems(menuItems, hasPermission);

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 hidden h-screen flex-col border-r
        border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]
        transition-[width] duration-300 ease-in-out lg:flex
        ${isCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width-expanded)]"}
      `}
    >
      <div
        className={`flex h-14 shrink-0 items-center gap-3 px-3 ${isCollapsed ? "justify-center" : ""}`}
      >
        <div
          className="
            flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
            bg-[var(--color-brand-primary)] text-[#0A0A0F]
          "
        >
          <Warehouse size={18} strokeWidth={2} />
        </div>

        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
              {t.sidebar.systemName}
            </p>
            <p className="truncate text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
              {t.sidebar.moduleName}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2">
        {!isCollapsed && (
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
            {t.sidebar.navigation}
          </p>
        )}

        <nav className="space-y-1">
          {visibleItems.map((item) => (
            <SidebarMenuItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              label={
                t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey
              }
            />
          ))}
        </nav>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] px-2.5 py-3">
        <SidebarUserPanel isCollapsed={isCollapsed} />
        <div className="mt-2.5">
          <SidebarActions isCollapsed={isCollapsed} showCollapse />
        </div>
      </div>
    </aside>
  );
}
