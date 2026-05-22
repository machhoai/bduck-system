/**
 * Menu Configuration — Centralized RBAC-aware navigation
 *
 * ► Mỗi item có `permission` optional. Nếu để trống = hiển thị cho tất cả.
 * ► Sidebar và BottomNav đều đọc từ config này → Single Source of Truth.
 * ► Khi thêm module mới, chỉ cần thêm 1 entry vào đây.
 */
import { Home, FolderTree, LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  labelKey: string;
  /** SVG path data cho icon (24x24 viewBox) */
  icon: LucideIcon;
  href: string;
  /** Permission key cần check. Nếu undefined = public cho authenticated users */
  permission?: string;
  /** Hiển thị trên bottom nav mobile? (chỉ 4-5 items) */
  showInBottomNav?: boolean;
}

/**
 * Danh sách menu items
 * ► labelKey tương ứng với key trong `t.nav.*`
 */
export const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    labelKey: 'dashboard',
    icon: Home,
    href: '/dashboard',
    showInBottomNav: true,
  },
  {
    id: 'categories',
    labelKey: 'categories',
    icon: FolderTree,
    href: '/categories',
    permission: 'category.read',
  },
  // ── Thêm module mới vào đây ──
];

/**
 * Filter menu items theo permissions của user
 */
export function getVisibleMenuItems(
  items: MenuItem[],
  hasPermission: (action: string) => boolean
): MenuItem[] {
  return items.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });
}
