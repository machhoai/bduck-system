"use client";

import { useEffect } from "react";
import { X, Warehouse } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";
import { useSidebarStore } from "../../stores/useSidebarStore";
import { menuItems, getVisibleMenuItems } from "../../config/menuConfig";
import SidebarActions from "./SidebarActions";
import SidebarMenuItem from "./SidebarMenuItem";
import SidebarUserPanel from "./SidebarUserPanel";

/**
 * MobileDrawer - native-feeling full menu for small screens.
 */
export default function MobileDrawer() {
  const { t } = useTranslation();
  const isOpen = useSidebarStore((s) => s.isMobileDrawerOpen);
  const closeDrawer = useSidebarStore((s) => s.closeDrawer);
  const hasPermission = useUserStore((s) => s.hasPermission);

  const visibleItems = getVisibleMenuItems(menuItems, hasPermission);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <div
        className={`
          fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}
        `}
        onClick={closeDrawer}
      />

      <div
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[300px] max-w-[88vw] flex-col lg:hidden
          border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary)] text-[#0A0A0F]">
              <Warehouse size={19} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                {t.sidebar.systemName}
              </p>
              <p className="truncate text-[11px] font-medium uppercase text-[var(--color-text-muted)]">
                {t.sidebar.moduleName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            className="
              flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
              text-[var(--color-text-muted)] transition-colors
              hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]
            "
            title={t.common.cancel}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
            {t.sidebar.navigation}
          </p>
          <nav className="space-y-1" onClick={closeDrawer}>
            {visibleItems.map((item) => (
              <SidebarMenuItem
                key={item.id}
                item={item}
                isCollapsed={false}
                label={
                  t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey
                }
              />
            ))}
          </nav>
        </div>

        <div
          className="space-y-3 border-t border-[var(--color-border-subtle)] px-3 pb-3 pt-3"
          style={{
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <SidebarUserPanel isCollapsed={false} />
          <SidebarActions />
        </div>
      </div>
    </>
  );
}
