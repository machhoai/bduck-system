"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "../../config/menuConfig";

interface SidebarMenuItemProps {
  item: MenuItem;
  isCollapsed: boolean;
  label: string;
}

/**
 * SidebarMenuItem — Menu item đơn lẻ trong sidebar
 *
 * ► Active state: highlight bằng brand-yellow left border + background tint
 * ► Collapsed mode: chỉ hiện icon, tooltip hiện label khi hover
 */
export default function SidebarMenuItem({
  item,
  isCollapsed,
  label,
}: SidebarMenuItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={isCollapsed ? label : undefined}
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

      {/* Icon */}
      <Icon size={19} strokeWidth={1.8} className="shrink-0" />

      {/* Label */}
      {!isCollapsed && (
        <span className="truncate text-[14px] font-normal tracking-[-0.224px]">
          {label}
        </span>
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
        </span>
      )}
    </Link>
  );
}
