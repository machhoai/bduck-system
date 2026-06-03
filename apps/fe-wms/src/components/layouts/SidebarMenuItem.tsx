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
        group relative flex min-h-8 items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5
        cursor-pointer transition-all duration-200 active:scale-95
        ${isCollapsed ? "justify-center" : ""}
        ${isActive
                    ? "bg-white text-[var(--color-surface-nav)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }
      `}
        >
            {/* Active indicator */}
            {showBadge && (
                <span className={`absolute left-0 flex items-center justify-between top-1/2  -translate-y-1/2 bg-[var(--color-brand-primary)] ${isCollapsed && showBadge && !isActive ? "!size-2 rounded-full" : "h-5 w-fit rounded-r-full"}`}>
                    {isCollapsed && showBadge && isActive && (
                        <span className=" flex items-center justify-center rounded-full pl-0.5 pr-1 text-xs font-bold text-white shadow-sm">
                            {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                    )}
                </span>
            )}

            {showBadge && !isCollapsed && (
                <span
                    className={`flex size-4 items-center justify-center rounded-full p-1.5 leading-0 text-xxs font-bold shadow-sm ${isActive
                        ? "bg-[var(--color-brand-primary)] text-white"
                        : "bg-[var(--color-brand-primary)]/90 text-white"
                        }`}
                >
                    {badgeCount > 99 ? "99+" : badgeCount}
                </span>
            )}

            {/* Icon + dot badge (collapsed mode) */}
            <span className={`shrink-0 ${(isCollapsed && showBadge) ? "pl-2" : ""}`}>
                <Icon size={19} strokeWidth={1.8} />
            </span>

            {/* Label + badge (expanded mode) */}
            {
                !isCollapsed && (
                    <>
                        <span className="min-w-0 flex-1 truncate text-sm font-normal tracking-normal">
                            {label}
                        </span>
                    </>
                )
            }

            {/* Tooltip khi collapsed */}
            {
                isCollapsed && (
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
                            <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-red-500 px-1 text-micro font-bold text-white">
                                {badgeCount}
                            </span>
                        )}
                    </span>
                )
            }
        </Link >
    );
}
