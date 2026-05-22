'use client';

import { useTranslation } from '../../lib/i18n';
import { useUserStore } from '../../stores/useUserStore';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { menuItems, getVisibleMenuItems } from '../../config/menuConfig';
import SidebarMenuItem from './SidebarMenuItem';
import SidebarUserPanel from './SidebarUserPanel';
import type { Dictionary } from '../../lib/i18n';

/**
 * Sidebar — Desktop sidebar cố định bên trái
 *
 * ► Expanded (256px): logo + menu labels + user info
 * ► Collapsed (72px): chỉ icons, tooltip khi hover
 * ► Toggle bằng nút ở bottom
 * ► Ẩn hoàn toàn trên mobile (<1024px)
 */
export default function Sidebar() {
  const { t } = useTranslation();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const hasPermission = useUserStore((s) => s.hasPermission);

  const visibleItems = getVisibleMenuItems(menuItems, hasPermission);


  return (
    <aside
      className={`
        hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40
        bg-[var(--color-surface-elevated)] border-r border-[var(--color-border-subtle)]
        transition-[width] duration-300 ease-in-out
      `}
      style={{
        width: isCollapsed
          ? 'var(--sidebar-width-collapsed)'
          : 'var(--sidebar-width-expanded)',
      }}
    >
      {/* ── Logo & System Name ── */}
      <div className={`flex items-center gap-3 px-4 h-16 shrink-0 ${isCollapsed ? 'justify-center' : ''}`}>
        {/* Logo mark */}
        <div className="
          shrink-0 w-8 h-8 rounded-lg
          bg-[var(--color-brand-primary)]
          flex items-center justify-center
        ">
          <span className="text-[#0A0A0F] text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            W
          </span>
        </div>

        {!isCollapsed && (
          <span
            className="text-sm font-bold text-[var(--color-text-primary)] truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t.sidebar.systemName}
          </span>
        )}
      </div>

      {/* ── Menu Items ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1">
        {visibleItems.map((item) => (
          <SidebarMenuItem
            key={item.id}
            item={item}
            isCollapsed={isCollapsed}
            label={t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey}
          />
        ))}
      </nav>

      {/* ── User Panel ── */}
      <div className="px-3 pb-3">
        <SidebarUserPanel isCollapsed={isCollapsed} />
      </div>

      {/* ── Toggle Button ── */}
      <button
        onClick={toggleCollapsed}
        className="
          flex items-center justify-center h-10 mx-3 mb-3 rounded-lg
          text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
          hover:bg-[var(--color-surface-card)]
          transition-all duration-200 cursor-pointer
        "
        title={isCollapsed ? t.sidebar.expand : t.sidebar.collapse}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
        >
          <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  );
}
