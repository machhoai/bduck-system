'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../lib/i18n';
import { useUserStore } from '../../stores/useUserStore';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { menuItems, getVisibleMenuItems } from '../../config/menuConfig';

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
        bg-[var(--color-surface-elevated)]/95 backdrop-blur-xl
        border-t border-[var(--color-border-subtle)]
      "
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[var(--bottomnav-height)]">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const label = t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5
                flex-1 h-full
                transition-colors duration-150
                ${isActive
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)]'
                }
              `}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isActive ? '2' : '1.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.iconPath} />
              </svg>
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
            transition-colors duration-150 cursor-pointer
          "
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
          <span className="text-[10px] font-medium">{t.nav.more}</span>
        </button>
      </div>
    </nav>
  );
}
