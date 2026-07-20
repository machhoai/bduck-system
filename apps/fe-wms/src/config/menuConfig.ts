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
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileSpreadsheet,
  Files,
  Home,
  IdCard,
  Package,
  PackagePlus,
  PackageMinus,
  PenLine,
  Settings,
  Users,
  Warehouse,
  LucideIcon,
  FolderSymlink,
  ScanBarcode,
  ReceiptText,
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
    permissionsAny: ["warehouses.read", "office_scopes.read"],
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
    id: "revenueManagement",
    labelKey: "revenueManagement",
    icon: ChartNoAxesCombined,
    href: "/revenue-management",
    permission: "revenue.read",
  },
  {
    id: "invoiceManagement",
    labelKey: "invoiceManagement",
    icon: ReceiptText,
    href: "/invoice-management",
    permissionsAny: ["invoices.read", "invoices.prepare", "invoices.reconcile"],
  },
  {
    id: "employeeAdmin",
    labelKey: "employeeAdmin",
    icon: IdCard,
    href: "/employee-admin",
    permissionsAny: [
      "attendance.check_in",
      "attendance.view",
      "attendance.export",
      "attendance.config",
    ],
    showInBottomNav: true,
  },
  {
    id: "notification",
    labelKey: "notification",
    icon: Bell,
    href: "/notification",
    permissionsAny: notificationPermissions,
  },
  {
    id: "reports",
    labelKey: "reports",
    icon: FileSpreadsheet,
    href: "/reports",
    permissionsAny: ["reports.templates.read", "reports.export"],
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
    id: "vouchers",
    labelKey: "vouchers",
    icon: PackagePlus,
    href: "/vouchers",
    permissionsAny: [
      "vouchers.read",
      "vouchers.write",
      "transfers.read",
      "transfers.write",
    ],
    badgeKey: "vouchers",
  },
  {
    id: "stockCounts",
    labelKey: "stockCount",
    icon: ClipboardList,
    href: "/stock-counts",
    permissionsAny: [
      "stock_counts.view",
      "stock_counts.create",
      "stock_counts.count",
      "external_count.view",
      "external_count.count",
    ],
  },
  {
    id: "fileLibrary",
    labelKey: "fileLibrary",
    icon: Files,
    href: "/file-library",
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
    permission: "workflows.manage",
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
    id: "employees",
    labelKey: "employees",
    icon: IdCard,
    href: "/employees",
    permission: "employees.read",
  },
  {
    id: "auditLogs",
    labelKey: "auditLogs",
    icon: FileClock,
    href: "/audit-logs",
    permission: "audit.read",
  },
  {
    id: "systemSettings",
    labelKey: "systemSettings",
    icon: Settings,
    href: "/system-settings",
    permission: "system.config",
  },
  {
    id: "externalQueue",
    labelKey: "externalQueue",
    icon: ScanBarcode,
    href: "/external/queue",
    permissionsAny: [
      "external_scan.view",
      "external_scan.approve",
      "external_count.view",
      "external_count.count",
    ],
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
