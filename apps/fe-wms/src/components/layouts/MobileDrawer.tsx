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
          border-r border-white/10 bg-[var(--color-surface-nav)] text-white
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-11 shrink-0 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white text-[var(--color-surface-nav)]">
              <Warehouse size={19} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-normal text-white">
                {t.sidebar.systemName}
              </p>
              <p className="truncate text-[10px] font-normal uppercase text-white/60">
                {t.sidebar.moduleName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            className="
              flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
              text-white/70 transition-all active:scale-95
              hover:bg-white/10 hover:text-white
            "
            title={t.common.cancel}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <p className="mb-2 px-3 text-[10px] font-normal uppercase text-white/50">
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
          className="space-y-3 border-t border-white/10 px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3"
        >
          <SidebarUserPanel isCollapsed={false} />
          <SidebarActions />
        </div>
      </div>
    </>
  );
}
