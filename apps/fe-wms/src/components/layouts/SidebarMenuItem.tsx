"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "../../config/menuConfig";

interface SidebarMenuItemProps {
  item: MenuItem;
  isCollapsed: boolean;
  label: string;
  /** Realtime badge count (0 = hidden) */
  badgeCount?: number;
}

/**
 * SidebarMenuItem — Menu item đơn lẻ trong sidebar
 *
 * ► Active state: highlight bằng brand-yellow left border + background tint
 * ► Collapsed mode: chỉ hiện icon, tooltip hiện label khi hover
 * ► Badge: realtime count pill (red dot when collapsed, number when expanded)
 */
export default function SidebarMenuItem({
  item,
  isCollapsed,
  label,
  badgeCount = 0,
}: SidebarMenuItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  const showBadge = badgeCount > 0;

  return (
    <Link
      href={item.href}
      title={isCollapsed ? `${label}${showBadge ? ` (${badgeCount})` : ""}` : undefined}
      className={`
        group relative flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5
        cursor-pointer transition-all duration-200 active:scale-95
        ${isCollapsed ? "justify-center" : ""}
        ${
          isActive
            ? "bg-white text-[var(--color-surface-nav)]"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }
      `}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-brand-primary)]" />
      )}

      {/* Icon + dot badge (collapsed mode) */}
      <span className="relative shrink-0">
        <Icon size={19} strokeWidth={1.8} />
        {isCollapsed && showBadge && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </span>

      {/* Label + badge (expanded mode) */}
      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-[14px] font-normal tracking-[-0.224px]">
            {label}
          </span>
          {showBadge && (
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-sm ${
                isActive
                  ? "bg-red-500 text-white"
                  : "bg-red-500/90 text-white"
              }`}
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </>
      )}

      {/* Tooltip khi collapsed */}
      {isCollapsed && (
        <span
          className="
          absolute left-full ml-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-normal
          bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]
          border border-[var(--color-border-subtle)]
          opacity-0 pointer-events-none group-hover:opacity-100
          transition-opacity duration-150 whitespace-nowrap z-50
        "
        >
          {label}
          {showBadge && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {badgeCount}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
