/**
 * Menu Configuration — Centralized RBAC-aware navigation
 *
 * ► Mỗi item có `permission` optional. Nếu để trống = hiển thị cho tất cả.
 * ► Sidebar và BottomNav đều đọc từ config này → Single Source of Truth.
 * ► Khi thêm module mới, chỉ cần thêm 1 entry vào đây.
 */
import {
    ArrowRightLeft,
    Bell,
    CircleDollarSign,
    ClipboardCheck,
    FileClock,
    Files,
    Home,
    Package,
    PackagePlus,
    PackageMinus,
    PenLine,
    Users,
    Warehouse,
    LucideIcon,
    FolderSymlink,
} from "lucide-react";
import { PERMISSION_REGISTRY } from "@bduck/shared-types";

export interface MenuItem {
    id: string;
    labelKey: string;
    /** SVG path data cho icon (24x24 viewBox) */
    icon: LucideIcon;
    href: string;
    /** Permission key cần check. Nếu undefined = public cho authenticated users */
    permission?: string;
    permissionsAny?: string[];
    /** Hiển thị trên bottom nav mobile? (chỉ 4-5 items) */
    showInBottomNav?: boolean;
    /** Key mapping to MenuBadges for realtime count display */
    badgeKey?: string;
}

const userAccessReadPermissions = PERMISSION_REGISTRY.filter(
    (permission) =>
        ["users", "roles"].includes(permission.group) &&
        permission.key.endsWith(".read"),
).map((permission) => permission.key);

const notificationPermissions = [
    "notifications.read",
    "notifications.send_in_app",
    "notifications.send_email",
];

/**
 * Danh sách menu items
 * ► labelKey tương ứng với key trong `t.nav.*`
 */
export const menuItems: MenuItem[] = [
    {
        id: "dashboard",
        labelKey: "dashboard",
        icon: Home,
        href: "/dashboard",
        showInBottomNav: true,
    },
    {
        id: "warehouses",
        labelKey: "warehouses",
        icon: Warehouse,
        href: "/warehouses",
        permission: "warehouses.read",
        showInBottomNav: true,
    },
    {
        id: "expenses",
        labelKey: "expenses",
        icon: CircleDollarSign,
        href: "/expenses",
        permission: "expenses.read",
    },
    {
        id: "notification",
        labelKey: "notification",
        icon: Bell,
        href: "/notification",
        permissionsAny: notificationPermissions,
    },
    {
        id: "tasks",
        labelKey: "tasks",
        icon: ClipboardCheck,
        href: "/tasks",
        showInBottomNav: true,
        badgeKey: "tasks",
    },
    {
        id: "importVouchers",
        labelKey: "importVoucher",
        icon: PackagePlus,
        href: "/import-vouchers",
        permission: "vouchers.read",
        badgeKey: "importVouchers",
    },
    {
        id: "exportVouchers",
        labelKey: "exportVoucher",
        icon: PackageMinus,
        href: "/export-vouchers",
        permission: "vouchers.read",
        badgeKey: "exportVouchers",
    },
    {
        id: "transfers",
        labelKey: "transfer",
        icon: ArrowRightLeft,
        href: "/transfers",
        permission: "transfers.read",
        badgeKey: "transfers",
    },
    {
        id: "fileLibrary",
        labelKey: "fileLibrary",
        icon: Files,
        href: "/file-library",
        permissionsAny: ["vouchers.read", "transfers.read"],
    },
    {
        id: "products",
        labelKey: "products",
        icon: Package,
        href: "/products",
        permission: "products.read",
    },
    {
        id: "processConfigs",
        labelKey: "processConfigs",
        icon: FolderSymlink,
        href: "/process-configs",
        permission: "workflow.read",
    },
    {
        id: "expenseEntry",
        labelKey: "expenseEntry",
        icon: PenLine,
        href: "/expenses/entry",
        permission: "expenses.read",
    },
    {
        id: "users",
        labelKey: "users",
        icon: Users,
        href: "/users",
        permissionsAny: userAccessReadPermissions,
    },
    {
        id: "auditLogs",
        labelKey: "auditLogs",
        icon: FileClock,
        href: "/audit-logs",
        permission: "audit.read",
    },
    // ── Thêm module mới vào đây ──
];

/**
 * Filter menu items theo permissions của user
 */
export function getVisibleMenuItems(
    items: MenuItem[],
    hasPermission: (action: string) => boolean,
): MenuItem[] {
    return items.filter((item) => {
        if (item.permission && hasPermission(item.permission)) return true;
        if (item.permissionsAny?.some((permission) => hasPermission(permission))) {
            return true;
        }
        return !item.permission && !item.permissionsAny;
    });
}
