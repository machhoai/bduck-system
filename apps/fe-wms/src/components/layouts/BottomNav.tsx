"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";
import { useSidebarStore } from "../../stores/useSidebarStore";
import { menuItems, getVisibleMenuItems } from "../../config/menuConfig";

/**
 * BottomNav — Mobile bottom navigation bar
 *
 * ► Hiển thị tối đa 4 tab + 1 nút "More" mở drawer
 * ► Safe area padding cho iOS (env(safe-area-inset-bottom))
 * ► Chỉ hiển thị trên mobile (<1024px)
 */
export default function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const hasPermission = useUserStore((s) => s.hasPermission);
  const openDrawer = useSidebarStore((s) => s.openDrawer);

  const visibleItems = getVisibleMenuItems(menuItems, hasPermission)
    .filter((item) => item.showInBottomNav)
    .slice(0, 4);

  return (
    <nav
      className="
        lg:hidden fixed bottom-0 left-0 right-0 z-50
        bg-[var(--color-surface-frosted)] backdrop-blur-xl
        border-t border-[var(--color-border-subtle)]
        pb-[env(safe-area-inset-bottom,0px)]
      "
    >
      <div className="flex items-center justify-around h-[var(--bottomnav-height)]">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const label =
            t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey;
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5
                flex-1 h-full
                transition-all duration-150 active:scale-95
                ${
                  isActive
                    ? "text-[var(--color-brand-primary)]"
                    : "text-[var(--color-text-muted)]"
                }
              `}
            >
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}

        {/* More button — mở drawer */}
        <button
          onClick={openDrawer}
          className="
            flex flex-col items-center justify-center gap-0.5
            flex-1 h-full
            text-[var(--color-text-muted)]
            transition-all duration-150 cursor-pointer active:scale-95
          "
        >
          <MoreHorizontal size={22} strokeWidth={1.5} />
          <span className="text-[10px] font-medium">{t.nav.more}</span>
        </button>
      </div>
    </nav>
  );
}
