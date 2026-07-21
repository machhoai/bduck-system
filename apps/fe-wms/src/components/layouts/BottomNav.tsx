"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";
import { useSidebarStore } from "../../stores/useSidebarStore";
import { menuItems, getVisibleMenuItems } from "../../config/menuConfig";
import { useLayoutMenuBadges } from "../providers/MenuBadgesProvider";

/**
 * BottomNav — Mobile bottom navigation bar
 *
 * ► Hiển thị tối đa 4 tab + 1 nút "More" mở drawer
 * ► Safe area padding cho iOS (env(safe-area-inset-bottom))
 * ► Chỉ hiển thị trên mobile (<1024px)
 * ► Badge count realtime cho tasks/import vouchers
 */
export default function BottomNav() {
    const { t } = useTranslation();
    const pathname = usePathname();
    const hasPermission = useUserStore((s) => s.hasPermission);
    const isOpen = useSidebarStore((s) => s.isMobileDrawerOpen);
    const openDrawer = useSidebarStore((s) => s.openDrawer);
    const closeDrawer = useSidebarStore((s) => s.closeDrawer);
    const badges = useLayoutMenuBadges();

    const visibleItems = getVisibleMenuItems(menuItems, hasPermission)
        .filter((item) => item.showInBottomNav)
        .slice(0, 4);

    return (
        <nav
            className="
        lg:hidden fixed bottom-0 left-0 right-0 z-100
        bg-[var(--color-surface-frosted)] backdrop-blur-xl
        border-t border-[var(--color-border-subtle)]
        pb-[env(safe-area-inset-bottom,0px)]
      "
        >
            <div className="flex items-center justify-around h-[68px]">
                {visibleItems.map((item) => {
                    const isActive =
                        pathname === item.href || pathname.startsWith(item.href + "/");
                    const label =
                        t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey;
                    const Icon = item.icon;
                    const badgeCount = item.badgeKey
                        ? badges[item.badgeKey as keyof typeof badges] || 0
                        : 0;

                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            onClick={closeDrawer}
                            className={`
                flex flex-col items-center justify-center gap-0.5
                flex-1 h-full relative
                transition-all duration-150 active:scale-95
                ${isActive
                                    ? "text-[var(--color-brand-primary)]"
                                    : "text-[var(--color-text-muted)]"
                                }
              `}
                        >
                            <span className="relative">
                                <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                                {badgeCount > 0 && (
                                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent-error)] px-1 text-micro font-bold text-white shadow-sm">
                                        {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                )}
                            </span>
                            <span className="text-xxs font-medium">{label}</span>
                        </Link>
                    );
                })}

                {/* More button — toggle drawer */}
                <button
                    onClick={() => (isOpen ? closeDrawer() : openDrawer())}
                    className={`
            flex flex-col items-center justify-center gap-0.5
            flex-1 h-full cursor-pointer
            transition-all duration-150 active:scale-95
            ${isOpen ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-muted)]"}
          `}
                >
                    {isOpen ? (
                        <X size={22} strokeWidth={2} />
                    ) : (
                        <MoreHorizontal size={22} strokeWidth={1.5} />
                    )}
                    <span className="text-xxs font-medium">
                        {isOpen ? (t.common?.cancel || "Đóng") : t.nav.more}
                    </span>
                </button>
            </div>
        </nav>
    );
}
