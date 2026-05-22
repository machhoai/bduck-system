'use client';

import { useAuth } from '../../hooks/useAuth';
import { useUserStore } from '../../stores/useUserStore';
import { useTranslation } from '../../lib/i18n';

interface SidebarUserPanelProps {
  isCollapsed: boolean;
}

/**
 * SidebarUserPanel — Thông tin user ở bottom sidebar
 *
 * ► Hiển thị: Avatar (chữ cái đầu) + tên + role + locations
 * ► Collapsed: chỉ hiện avatar, hover tooltip
 * ► Logout nút luôn hiển thị
 */
export default function SidebarUserPanel({ isCollapsed }: SidebarUserPanelProps) {
  const { t } = useTranslation();
  const { logout, isLoading } = useAuth();
  const user = useUserStore((s) => s.user);
  const permissions = useUserStore((s) => s.permissions);

  if (!user) return null;

  // Lấy chữ cái đầu cho avatar
  const initials = user.full_name
    ?.split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  // Xác định role từ permissions scopes
  const scopes = Object.keys(permissions);
  const isGlobal = scopes.includes('global');
  const roleName = isGlobal
    ? t.roles.ADMIN
    : scopes.length > 0
      ? t.roles.WAREHOUSE_STAFF
      : '';

  // Danh sách locations (warehouse IDs, trừ 'global')
  const locationIds = scopes.filter((s) => s !== 'global');

  return (
    <div className="border-t border-[var(--color-border-subtle)] pt-3 mt-3">
      <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
        {/* Avatar */}
        <div className="
          shrink-0 w-9 h-9 rounded-lg
          bg-[var(--color-brand-primary)] text-[#0A0A0F]
          flex items-center justify-center
          text-xs font-bold
        ">
          {initials}
        </div>

        {/* Info (ẩn khi collapsed) */}
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {user.full_name}
            </p>
            {roleName && (
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {roleName}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Locations list (chỉ hiện khi expanded) */}
      {!isCollapsed && locationIds.length > 0 && (
        <div className="mt-2 pl-12">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            {t.user.locations}
          </p>
          {locationIds.slice(0, 3).map((id) => (
            <span
              key={id}
              className="
                inline-block mr-1 mb-1 px-2 py-0.5 rounded text-[10px]
                bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]
                border border-[var(--color-border-subtle)]
              "
            >
              {id.slice(0, 8)}…
            </span>
          ))}
          {locationIds.length > 3 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              +{locationIds.length - 3}
            </span>
          )}
        </div>
      )}

      {!isCollapsed && isGlobal && (
        <div className="mt-2 pl-12">
          <span className="
            inline-block px-2 py-0.5 rounded text-[10px]
            bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]
            border border-[var(--color-brand-primary)]/20
          ">
            {t.user.globalScope}
          </span>
        </div>
      )}

      {/* Logout button */}
      <button
        onClick={logout}
        disabled={isLoading}
        className={`
          mt-3 flex items-center gap-2 rounded-lg px-3 py-2 w-full
          text-sm text-[var(--color-text-muted)]
          hover:bg-[var(--color-accent-error)]/10 hover:text-[var(--color-accent-error)]
          transition-all duration-200 cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed
          ${isCollapsed ? 'justify-center' : ''}
        `}
        title={isCollapsed ? t.user.logout : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        {!isCollapsed && <span>{t.user.logout}</span>}
      </button>
    </div>
  );
}
