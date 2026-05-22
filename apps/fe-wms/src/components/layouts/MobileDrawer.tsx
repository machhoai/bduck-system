'use client';

import { useEffect } from 'react';
import { useTranslation } from '../../lib/i18n';
import { useUserStore } from '../../stores/useUserStore';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { menuItems, getVisibleMenuItems } from '../../config/menuConfig';
import SidebarMenuItem from './SidebarMenuItem';
import SidebarUserPanel from './SidebarUserPanel';

/**
 * MobileDrawer — Full-screen drawer từ trái cho mobile
 *
 * ► Trượt vào từ bên trái với backdrop blur overlay
 * ► Chứa full menu + user info (giống sidebar expanded)
 * ► Đóng khi click backdrop hoặc bấm link
 */
export default function MobileDrawer() {
  const { t } = useTranslation();
  const isOpen = useSidebarStore((s) => s.isMobileDrawerOpen);
  const closeDrawer = useSidebarStore((s) => s.closeDrawer);
  const hasPermission = useUserStore((s) => s.hasPermission);

  const visibleItems = getVisibleMenuItems(menuItems, hasPermission);

  // Lock body scroll khi drawer mở
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={closeDrawer}
      />

      {/* Drawer Panel */}
      <div
        className={`
          lg:hidden fixed left-0 top-0 h-full z-50
          w-[280px] max-w-[85vw]
          bg-[var(--color-surface-elevated)]
          border-r border-[var(--color-border-subtle)]
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
              <span className="text-[#0A0A0F] text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                W
              </span>
            </div>
            <span
              className="text-sm font-bold text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t.sidebar.systemName}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={closeDrawer}
            className="
              p-2 rounded-lg
              text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
              hover:bg-[var(--color-surface-card)]
              transition-colors cursor-pointer
            "
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Menu items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1" onClick={closeDrawer}>
          {visibleItems.map((item) => (
            <SidebarMenuItem
              key={item.id}
              item={item}
              isCollapsed={false}
              label={t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey}
            />
          ))}
        </nav>

        {/* User Panel */}
        <div className="px-3 pb-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <SidebarUserPanel isCollapsed={false} />
        </div>
      </div>
    </>
  );
}
