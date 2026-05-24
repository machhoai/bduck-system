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
        group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5
        transition-all duration-200 cursor-pointer
        ${isCollapsed ? "justify-center" : ""}
        ${
          isActive
            ? "bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
        }
      `}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--color-brand-primary)]" />
      )}

      {/* Icon */}
      <Icon size={19} strokeWidth={1.8} className="shrink-0" />

      {/* Label */}
      {!isCollapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}

      {/* Tooltip khi collapsed */}
      {isCollapsed && (
        <span
          className="
          absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium
          bg-[var(--color-surface-card)] text-[var(--color-text-primary)]
          border border-[var(--color-border-subtle)]
          opacity-0 pointer-events-none group-hover:opacity-100
          transition-opacity duration-150 whitespace-nowrap z-50
          shadow-lg
        "
        >
          {label}
        </span>
      )}
    </Link>
  );
}
