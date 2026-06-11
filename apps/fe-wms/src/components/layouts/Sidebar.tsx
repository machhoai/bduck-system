"use client";

import { Warehouse } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";
import { useSidebarStore } from "../../stores/useSidebarStore";
import { getVisibleMenuItems, menuItems } from "../../config/menuConfig";
import { useMenuBadges } from "../../hooks/useMenuBadges";
import SidebarActions from "./SidebarActions";
import Image from "next/image";
import SidebarMenuItem from "./SidebarMenuItem";
import SidebarUserPanel from "./SidebarUserPanel";

export default function Sidebar() {
    const { t } = useTranslation();
    const isCollapsed = useSidebarStore((s) => s.isCollapsed);
    const hasPermission = useUserStore((s) => s.hasPermission);
    const visibleItems = getVisibleMenuItems(menuItems, hasPermission);
    const badges = useMenuBadges();

    return (
        <aside
            id="wms-sidebar"
            className={`
        fixed left-0 top-0 z-40 hidden h-screen flex-col border-r
        border-[var(--color-border-soft)] bg-[var(--color-surface-nav)]
        text-[var(--color-text-on-dark)]
        transition-[width] duration-300 ease-in-out lg:flex rounded-r-md
        ${isCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width-expanded)]"}
      `}
        >
            <div
                className={`flex h-20 w-full ${isCollapsed ? "justify-center" : ""}`}
            >
                <div className={`relative w-full h-full`}>
                    <Image
                        src={isCollapsed ? "/logo/jw.png" : "/logo/jwc-h.png"}
                        alt="Logo"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2">
                {!isCollapsed && (
                    <p className="mb-1.5 px-2.5 text-xxs font-normal uppercase tracking-normal text-white/50">
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
                            badgeCount={
                                item.badgeKey
                                    ? badges[item.badgeKey as keyof typeof badges] || 0
                                    : 0
                            }
                        />
                    ))}
                </nav>
            </div>

            <div className="border-t border-white/10 px-2.5 py-3">
                <SidebarUserPanel isCollapsed={isCollapsed} />
                <div className="mt-2.5">
                    <SidebarActions isCollapsed={isCollapsed} showCollapse />
                </div>
            </div>
        </aside>
    );
}
