/**
 * Permission Registry — Single Source of Truth
 *
 * Mọi permission key, tên hiển thị (vi/zh), mô tả, và nhóm
 * đều được định nghĩa tại đây. Frontend & Backend import từ file này.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PermissionDefinition {
  /** Unique permission key used in RBAC checks (e.g. "products.read") */
  key: string;
  /** Group identifier for UI grouping */
  group: string;
  /** Localized display name */
  label: { vi: string; zh: string };
  /** Localized description */
  description: { vi: string; zh: string };
}

export interface PermissionGroup {
  /** Group identifier */
  id: string;
  /** Localized group display name */
  label: { vi: string; zh: string };
  /** Icon hint for frontend rendering */
  icon: string;
  /** Sort order */
  order: number;
}

// ─────────────────────────────────────────────
// Permission Groups
// ─────────────────────────────────────────────

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "system",
    label: { vi: "Hệ thống", zh: "系统" },
    icon: "Shield",
    order: 0,
  },
  {
    id: "products",
    label: { vi: "Sản phẩm", zh: "产品" },
    icon: "Package",
    order: 1,
  },
  {
    id: "categories",
    label: { vi: "Danh mục", zh: "分类" },
    icon: "FolderTree",
    order: 2,
  },
  {
    id: "warehouses",
    label: { vi: "Kho hàng", zh: "仓库" },
    icon: "Warehouse",
    order: 3,
  },
  {
    id: "locations",
    label: { vi: "Vị trí kho", zh: "库位" },
    icon: "MapPin",
    order: 4,
  },
  {
    id: "organizations",
    label: { vi: "Tổ chức", zh: "组织" },
    icon: "Building2",
    order: 5,
  },
  {
    id: "inventory",
    label: { vi: "Tồn kho", zh: "库存" },
    icon: "BarChart3",
    order: 6,
  },
  {
    id: "vouchers",
    label: { vi: "Phiếu nhập / xuất", zh: "入库/出库单" },
    icon: "FileText",
    order: 7,
  },
  {
    id: "workflows",
    label: { vi: "Quy trình", zh: "工作流" },
    icon: "GitBranch",
    order: 8,
  },
  {
    id: "users",
    label: { vi: "Người dùng", zh: "用户" },
    icon: "Users",
    order: 9,
  },
  {
    id: "roles",
    label: { vi: "Phân quyền", zh: "角色权限" },
    icon: "ShieldCheck",
    order: 10,
  },
  {
    id: "audit",
    label: { vi: "Nhật ký hệ thống", zh: "审计日志" },
    icon: "FileClock",
    order: 11,
  },
];

// ─────────────────────────────────────────────
// Permission Definitions
// ─────────────────────────────────────────────

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  // ── System ──
  {
    key: "*",
    group: "system",
    label: { vi: "Toàn quyền hệ thống", zh: "系统完全权限" },
    description: {
      vi: "Cấp tất cả quyền trên toàn bộ hệ thống. Chỉ nên gán cho Admin.",
      zh: "授予系统所有权限。仅应分配给管理员。",
    },
  },

  // ── Products ──
  {
    key: "products.read",
    group: "products",
    label: { vi: "Xem sản phẩm", zh: "查看产品" },
    description: {
      vi: "Xem danh sách và chi tiết sản phẩm, BOM định mức.",
      zh: "查看产品列表、详情及BOM定额。",
    },
  },
  {
    key: "products.write",
    group: "products",
    label: { vi: "Quản lý sản phẩm", zh: "管理产品" },
    description: {
      vi: "Tạo mới, chỉnh sửa và xóa mềm sản phẩm, cập nhật BOM.",
      zh: "创建、编辑、软删除产品，更新BOM。",
    },
  },

  // ── Categories ──
  {
    key: "category.read",
    group: "categories",
    label: { vi: "Xem danh mục", zh: "查看分类" },
    description: {
      vi: "Xem cây danh mục sản phẩm.",
      zh: "查看产品分类树。",
    },
  },
  {
    key: "category.create",
    group: "categories",
    label: { vi: "Tạo danh mục", zh: "创建分类" },
    description: {
      vi: "Tạo danh mục sản phẩm mới.",
      zh: "创建新产品分类。",
    },
  },
  {
    key: "category.update",
    group: "categories",
    label: { vi: "Sửa danh mục", zh: "编辑分类" },
    description: {
      vi: "Chỉnh sửa tên, mã, mô tả danh mục.",
      zh: "编辑分类名称、代码、描述。",
    },
  },
  {
    key: "category.delete",
    group: "categories",
    label: { vi: "Xóa danh mục", zh: "删除分类" },
    description: {
      vi: "Xóa mềm danh mục sản phẩm.",
      zh: "软删除产品分类。",
    },
  },

  // ── Warehouses ──
  {
    key: "warehouses.read",
    group: "warehouses",
    label: { vi: "Xem kho hàng", zh: "查看仓库" },
    description: {
      vi: "Xem danh sách kho, thông tin chi tiết và bản đồ.",
      zh: "查看仓库列表、详情和地图。",
    },
  },
  {
    key: "warehouses.write",
    group: "warehouses",
    label: { vi: "Quản lý kho hàng", zh: "管理仓库" },
    description: {
      vi: "Tạo, sửa và xóa mềm kho hàng.",
      zh: "创建、编辑、软删除仓库。",
    },
  },

  // ── Locations ──
  {
    key: "locations.read",
    group: "locations",
    label: { vi: "Xem vị trí kho", zh: "查看库位" },
    description: {
      vi: "Xem danh sách vị trí lưu trữ trong kho.",
      zh: "查看仓库中的存储位置列表。",
    },
  },
  {
    key: "locations.write",
    group: "locations",
    label: { vi: "Quản lý vị trí kho", zh: "管理库位" },
    description: {
      vi: "Tạo, sửa và xóa mềm vị trí kho.",
      zh: "创建、编辑、软删除库位。",
    },
  },
  {
    key: "locations.quarantine",
    group: "locations",
    label: { vi: "Cách ly vị trí", zh: "隔离库位" },
    description: {
      vi: "Đánh dấu cách ly hoặc gỡ cách ly vị trí kho.",
      zh: "标记或解除库位隔离。",
    },
  },

  // ── Organizations ──
  {
    key: "organizations.read",
    group: "organizations",
    label: { vi: "Xem tổ chức", zh: "查看组织" },
    description: {
      vi: "Xem danh sách và chi tiết tổ chức.",
      zh: "查看组织列表和详情。",
    },
  },
  {
    key: "organizations.write",
    group: "organizations",
    label: { vi: "Quản lý tổ chức", zh: "管理组织" },
    description: {
      vi: "Tạo, sửa và xóa mềm tổ chức.",
      zh: "创建、编辑、软删除组织。",
    },
  },

  // ── Inventory ──
  {
    key: "inventory.read",
    group: "inventory",
    label: { vi: "Xem tồn kho", zh: "查看库存" },
    description: {
      vi: "Xem số liệu tồn kho, ATP, cách ly và đang chuyển.",
      zh: "查看库存数量、ATP、隔离及在途。",
    },
  },
  {
    key: "inventory.write",
    group: "inventory",
    label: { vi: "Quản lý tồn kho", zh: "管理库存" },
    description: {
      vi: "Cập nhật và xóa bản ghi tồn kho.",
      zh: "更新和删除库存记录。",
    },
  },

  // ── Vouchers ──
  {
    key: "vouchers.read",
    group: "vouchers",
    label: { vi: "Xem phiếu nhập / xuất", zh: "查看入库/出库单" },
    description: {
      vi: "Xem phiếu nhập kho, xuất kho và timeline phê duyệt.",
      zh: "查看入库单、出库单及审批时间线。",
    },
  },
  {
    key: "vouchers.write",
    group: "vouchers",
    label: { vi: "Tạo & sửa phiếu", zh: "创建和编辑单据" },
    description: {
      vi: "Tạo phiếu nhập/xuất mới, cập nhật phiên kiểm đếm.",
      zh: "创建新入库/出库单，更新盘点会话。",
    },
  },

  // ── Workflows ──
  {
    key: "workflows.manage",
    group: "workflows",
    label: { vi: "Quản lý quy trình", zh: "管理工作流" },
    description: {
      vi: "Tạo, sửa, lưu trữ quy trình phê duyệt và xuất bản phiên bản.",
      zh: "创建、编辑、归档审批流程并发布版本。",
    },
  },
  {
    key: "workflows.execute",
    group: "workflows",
    label: { vi: "Thực thi quy trình", zh: "执行工作流" },
    description: {
      vi: "Khởi chạy quy trình và hoàn thành các task phê duyệt.",
      zh: "启动流程并完成审批任务。",
    },
  },

  // ── Users ──
  {
    key: "users.read",
    group: "users",
    label: { vi: "Xem người dùng", zh: "查看用户" },
    description: {
      vi: "Xem danh sách người dùng và thông tin tài khoản.",
      zh: "查看用户列表和账户信息。",
    },
  },
  {
    key: "users.write",
    group: "users",
    label: { vi: "Quản lý người dùng", zh: "管理用户" },
    description: {
      vi: "Tạo, sửa, xóa mềm tài khoản và gán role.",
      zh: "创建、编辑、软删除账户并分配角色。",
    },
  },

  // ── Roles ──
  {
    key: "roles.read",
    group: "roles",
    label: { vi: "Xem vai trò", zh: "查看角色" },
    description: {
      vi: "Xem danh sách vai trò và quyền hạn.",
      zh: "查看角色列表和权限。",
    },
  },
  {
    key: "roles.write",
    group: "roles",
    label: { vi: "Quản lý vai trò", zh: "管理角色" },
    description: {
      vi: "Tạo, sửa, xóa mềm vai trò và cấu hình phân quyền.",
      zh: "创建、编辑、软删除角色并配置权限。",
    },
  },

  // ── Audit ──
  {
    key: "audit.read",
    group: "audit",
    label: { vi: "Xem nhật ký", zh: "查看日志" },
    description: {
      vi: "Xem lịch sử thao tác, dữ liệu cũ/mới và truy vết người dùng.",
      zh: "查看操作历史、新旧数据及用户追踪。",
    },
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** All permission keys (excluding "*") for validation */
export const ALL_PERMISSION_KEYS = PERMISSION_REGISTRY
  .filter((p) => p.key !== "*")
  .map((p) => p.key);

/** Get permissions grouped by their group id */
export function getPermissionsByGroup(): Map<string, PermissionDefinition[]> {
  const map = new Map<string, PermissionDefinition[]>();
  for (const perm of PERMISSION_REGISTRY) {
    const list = map.get(perm.group) || [];
    list.push(perm);
    map.set(perm.group, list);
  }
  return map;
}

/** Find a permission definition by key */
export function getPermissionByKey(
  key: string,
): PermissionDefinition | undefined {
  return PERMISSION_REGISTRY.find((p) => p.key === key);
}
