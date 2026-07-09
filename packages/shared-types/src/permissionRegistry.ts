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
    id: "reports",
    label: { vi: "Báo cáo", zh: "报表" },
    icon: "FileSpreadsheet",
    order: 7,
  },
  {
    id: "file_library",
    label: { vi: "Thư viện tệp", zh: "文件库" },
    icon: "Files",
    order: 7,
  },
  {
    id: "vouchers",
    label: { vi: "Phiếu nhập / xuất", zh: "入库/出库单" },
    icon: "FileText",
    order: 8,
  },
  {
    id: "transfers",
    label: { vi: "Điều chuyển", zh: "调拨" },
    icon: "ArrowLeftRight",
    order: 9,
  },
  {
    id: "workflows",
    label: { vi: "Quy trình", zh: "工作流" },
    icon: "GitBranch",
    order: 9,
  },
  {
    id: "notifications",
    label: { vi: "Thông báo", zh: "通知" },
    icon: "Bell",
    order: 10,
  },
  {
    id: "users",
    label: { vi: "Người dùng", zh: "用户" },
    icon: "Users",
    order: 11,
  },
  {
    id: "roles",
    label: { vi: "Phân quyền", zh: "角色权限" },
    icon: "ShieldCheck",
    order: 12,
  },
  {
    id: "employees",
    label: { vi: "Nhân viên", zh: "员工" },
    icon: "IdCard",
    order: 13,
  },
  {
    id: "expenses",
    label: { vi: "Quản lý chi phí", zh: "费用管理" },
    icon: "Receipt",
    order: 14,
  },
  {
    id: "revenue",
    label: { vi: "Quản lý doanh thu", zh: "营收管理" },
    icon: "ChartNoAxesCombined",
    order: 15,
  },
  {
    id: "audit",
    label: { vi: "Nhật ký hệ thống", zh: "审计日志" },
    icon: "FileClock",
    order: 16,
  },
  {
    id: "attendance",
    label: { vi: "Chấm công", zh: "考勤" },
    icon: "CalendarCheck",
    order: 17,
  },
  {
    id: "external",
    label: { vi: "Tích hợp ngoài", zh: "外部集成" },
    icon: "ScanBarcode",
    order: 18,
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
    key: "system.config",
    group: "system",
    label: { vi: "Cau hinh he thong", zh: "系统配置" },
    description: {
      vi: "Cho phep xem va cap nhat cau hinh tich hop he thong theo cua hang.",
      zh: "允许查看并更新按门店划分的系统集成配置。",
    },
  },
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
  {
    key: "products.price.view",
    group: "products",
    label: { vi: "Xem đơn giá sản phẩm", zh: "查看产品单价" },
    description: {
      vi: "Xem đơn giá sản phẩm trong mọi màn hình: danh mục, tồn kho, phiếu nhập/xuất. Chỉ nên cấp cho quản lý và kế toán.",
      zh: "在所有界面（目录、库存、入/出库单）查看产品单价。仅应授予管理者和财务人员。",
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

  // ── Reports ──
  {
    key: "reports.templates.read",
    group: "reports",
    label: { vi: "Xem mẫu báo cáo", zh: "查看报表模板" },
    description: {
      vi: "Xem các mẫu báo cáo cá nhân và mẫu được chia sẻ.",
      zh: "查看个人和共享报表模板。",
    },
  },
  {
    key: "reports.templates.write",
    group: "reports",
    label: { vi: "Quản lý mẫu báo cáo", zh: "管理报表模板" },
    description: {
      vi: "Tạo, sửa và lưu mapping cho mẫu báo cáo.",
      zh: "创建、编辑并保存报表模板映射。",
    },
  },
  {
    key: "reports.templates.share",
    group: "reports",
    label: { vi: "Chia sẻ mẫu báo cáo", zh: "共享报表模板" },
    description: {
      vi: "Bật chế độ dùng chung mẫu báo cáo trên toàn hệ thống.",
      zh: "将报表模板共享给全系统使用。",
    },
  },
  {
    key: "reports.export",
    group: "reports",
    label: { vi: "Xuất báo cáo", zh: "导出报表" },
    description: {
      vi: "Preview và xuất file báo cáo từ template đã lưu.",
      zh: "预览并从已保存模板导出报表文件。",
    },
  },

  // ── File Library ──
  {
    key: "file_templates.upload",
    group: "file_library",
    label: { vi: "Upload biểu mẫu", zh: "上传表单模板" },
    description: {
      vi: "Cho phép tải lên biểu mẫu PDF, DOCX, XLSX hoặc CSV để người khác tải xuống.",
      zh: "允许上传 PDF、DOCX、XLSX 或 CSV 表单模板供他人下载。",
    },
  },
  {
    key: "file_templates.view",
    group: "file_library",
    label: { vi: "Xem biểu mẫu", zh: "查看表单模板" },
    description: {
      vi: "Xem và tải xuống các biểu mẫu đã được upload.",
      zh: "查看并下载已上传的表单模板。",
    },
  },
  {
    key: "file_templates.edit",
    group: "file_library",
    label: { vi: "Chỉnh sửa biểu mẫu", zh: "编辑表单模板" },
    description: {
      vi: "Chỉnh sửa tên, mô tả, phân loại và cập nhật phiên bản mới cho biểu mẫu.",
      zh: "编辑表单模板的名称、说明、分类并上传新版本。",
    },
  },
  {
    key: "file_templates.delete",
    group: "file_library",
    label: { vi: "Xóa biểu mẫu", zh: "删除表单模板" },
    description: {
      vi: "Xóa mềm biểu mẫu khỏi thư viện biểu mẫu.",
      zh: "从表单模板库中软删除表单模板。",
    },
  },
  {
    key: "file_library.uploaded_files.view_all",
    group: "file_library",
    label: { vi: "Xem tất cả tệp đã tải lên", zh: "查看所有已上传文件" },
    description: {
      vi: "Xem tất cả tệp đính kèm từ phiếu. Nếu không có quyền này, user chỉ thấy tệp do chính mình upload.",
      zh: "查看所有单据附件。没有此权限时，用户只能看到自己上传的文件。",
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
  {
    key: "vouchers.force_cancel",
    group: "vouchers",
    label: { vi: "Hủy lệnh bất kỳ lúc nào", zh: "随时撤销单据" },
    description: {
      vi: "Hủy lệnh/phiếu ở bất kỳ trạng thái nào, kể cả đã được phê duyệt. Chỉ nên cấp cho quản lý cấp cao.",
      zh: "在任何状态下撤销单据，包括已审批的。仅应授予高级管理人员。",
    },
  },

  // ── Transfers ──
  {
    key: "transfers.read",
    group: "transfers",
    label: { vi: "Xem điều chuyển", zh: "查看调拨" },
    description: {
      vi: "Xem danh sách và chi tiết phiếu điều chuyển.",
      zh: "查看调拨单列表和详情。",
    },
  },
  {
    key: "transfers.write",
    group: "transfers",
    label: { vi: "Tạo & sửa điều chuyển", zh: "创建和编辑调拨" },
    description: {
      vi: "Tạo phiếu điều chuyển trong kho hoặc liên kho, cập nhật thông tin.",
      zh: "创建库内或跨库调拨单，更新信息。",
    },
  },
  {
    key: "transfers.receive",
    group: "transfers",
    label: { vi: "Nhận hàng điều chuyển", zh: "接收调拨货物" },
    description: {
      vi: "Nhận hàng và kiểm đếm phiếu điều chuyển liên kho tại kho đích.",
      zh: "在目标仓库接收并盘点跨库调拨货物。",
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

  // ── Notifications ──
  {
    key: "notifications.read",
    group: "notifications",
    label: { vi: "Xem lịch sử thông báo", zh: "查看通知历史" },
    description: {
      vi: "Xem lịch sử các lượt gửi thông báo in-app và email.",
      zh: "查看应用内通知和邮件发送历史。",
    },
  },
  {
    key: "notifications.send_in_app",
    group: "notifications",
    label: { vi: "Gửi thông báo in-app", zh: "发送应用内通知" },
    description: {
      vi: "Gửi thông báo realtime trong hệ thống cho người dùng hoặc vai trò.",
      zh: "向用户或角色发送系统内实时通知。",
    },
  },
  {
    key: "notifications.send_email",
    group: "notifications",
    label: { vi: "Gửi email", zh: "发送邮件" },
    description: {
      vi: "Soạn và gửi email qua dịch vụ Brevo.",
      zh: "通过 Brevo 服务编写并发送电子邮件。",
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

  // ── Employees ──
  {
    key: "employees.read",
    group: "employees",
    label: { vi: "Xem hồ sơ nhân viên", zh: "查看员工档案" },
    description: {
      vi: "Xem danh sách hồ sơ nhân viên, thông tin liên kết tài khoản và nơi làm việc.",
      zh: "查看员工档案、账户关联和工作地点。",
    },
  },
  {
    key: "employees.write",
    group: "employees",
    label: { vi: "Quản lý hồ sơ nhân viên", zh: "管理员工档案" },
    description: {
      vi: "Tạo, cập nhật, xóa mềm hồ sơ nhân viên và liên kết tài khoản người dùng.",
      zh: "创建、更新、软删除员工档案并关联用户账户。",
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

  // ── Expenses ──
  {
    key: "attendance.check_in",
    group: "attendance",
    label: { vi: "Check-in chấm công", zh: "考勤打卡" },
    description: {
      vi: "Cho phép mở trang chấm công cá nhân và thực hiện check-in nếu kho đang bật chấm công.",
      zh: "允许打开个人考勤页面，并在仓库启用考勤时打卡。",
    },
  },
  {
    key: "attendance.view",
    group: "attendance",
    label: { vi: "Xem chấm công", zh: "查看考勤" },
    description: {
      vi: "Xem lịch chấm công và log check-in lỗi trong phạm vi kho được phân quyền.",
      zh: "查看授权仓库范围内的考勤日历和失败打卡日志。",
    },
  },
  {
    key: "attendance.export",
    group: "attendance",
    label: { vi: "Xuất Excel chấm công", zh: "导出考勤" },
    description: {
      vi: "Xuất Excel dữ liệu chấm công theo bộ lọc hiện tại.",
      zh: "根据当前筛选条件导出考勤数据。",
    },
  },
  {
    key: "attendance.config",
    group: "attendance",
    label: { vi: "Cấu hình chấm công", zh: "配置考勤" },
    description: {
      vi: "Bật/tắt chấm công theo kho, cấu hình IP hợp lệ và danh sách nhân viên miễn chấm công.",
      zh: "按仓库启用/停用考勤，配置允许 IP 和免考勤人员。",
    },
  },

  {
    key: "expenses.read",
    group: "expenses",
    label: { vi: "Xem chi phí", zh: "查看费用" },
    description: {
      vi: "Xem chi phí kho hiện tại",
      zh: "查看当前仓库费用",
    },
  },
  {
    key: "expenses.consolidated.view",
    group: "expenses",
    label: { vi: "Xem tổng hợp chi phí", zh: "查看综合费用" },
    description: {
      vi: "Xem tổng hợp TẤT CẢ các kho - Dành cho BOD",
      zh: "查看所有仓库的综合费用 - 供BOD使用",
    },
  },
  {
    key: "expenses.operations.write",
    group: "expenses",
    label: { vi: "Nhập liệu vận hành", zh: "录入运营费用" },
    description: {
      vi: "Nhập liệu nhóm Vận hành",
      zh: "运营团队的数据录入",
    },
  },
  {
    key: "expenses.hr.write",
    group: "expenses",
    label: { vi: "Nhập liệu nhân sự", zh: "录入人事费用" },
    description: {
      vi: "Nhập liệu nhóm Nhân sự",
      zh: "人事团队的数据录入",
    },
  },
  {
    key: "expenses.marketing.write",
    group: "expenses",
    label: { vi: "Nhập liệu Marketing", zh: "录入营销费用" },
    description: {
      vi: "Nhập liệu nhóm Marketing (quảng cáo, chiến dịch)",
      zh: "营销团队数据录入（广告、活动）",
    },
  },
  {
    key: "expenses.merchandise.write",
    group: "expenses",
    label: { vi: "Nhập liệu hàng hóa", zh: "录入商品费用" },
    description: {
      vi: "Nhập liệu nhóm Hàng hóa (COGS, quà tặng)",
      zh: "商品团队数据录入（销售成本、礼品）",
    },
  },
  {
    key: "expenses.others.write",
    group: "expenses",
    label: { vi: "Nhập liệu khác", zh: "录入其他费用" },
    description: {
      vi: "Nhập liệu nhóm Khác",
      zh: "其他团队的数据录入",
    },
  },
  {
    key: "expenses.close_period",
    group: "expenses",
    label: { vi: "Chốt kỳ kế toán", zh: "结账" },
    description: {
      vi: "Quyền chốt kỳ kế toán",
      zh: "结账权限",
    },
  },
  {
    key: "expenses.reopen_period",
    group: "expenses",
    label: { vi: "Mở lại kỳ kế toán", zh: "重新开放会计期间" },
    description: {
      vi: "Quyền mở lại kỳ kế toán đã chốt",
      zh: "重新开放已结账的会计期间",
    },
  },

  // Revenue
  {
    key: "revenue.read",
    group: "revenue",
    label: { vi: "Xem doanh thu", zh: "查看营收" },
    description: {
      vi: "Xem dashboard doanh thu JoyWorld cho cửa hàng B.Duck Cityfuns Landmark 81.",
      zh: "查看 B.Duck Cityfuns Landmark 81 门店的 JoyWorld 营收仪表板。",
    },
  },

  // ── External ──
  {
    key: "external_scan.approve",
    group: "external",
    label: { vi: "Duyệt hàng chờ từ hệ thống ngoài", zh: "审批外部扫描队列" },
    description: {
      vi: "Duyệt hoặc từ chối các phiên quét mã từ hệ thống POS/Scanner.",
      zh: "审批或拒绝来自POS/扫描仪系统的扫描会话。",
    },
  },
  {
    key: "external_scan.edit_quantity",
    group: "external",
    label: { vi: "Chỉnh số lượng hàng chờ quét", zh: "编辑外部扫描队列数量" },
    description: {
      vi: "Chỉnh sửa số lượng hàng hóa trong hàng chờ quét từ hệ thống ngoài trước khi duyệt.",
      zh: "在审批前编辑来自外部系统的扫描队列商品数量。",
    },
  },
  {
    key: "external_scan.manage_queue",
    group: "external",
    label: { vi: "Quan ly hang cho quet", zh: "管理外部扫描队列" },
    description: {
      vi: "Huy muc trong hang cho va chay co che tu dong submit theo quay.",
      zh: "取消队列项并执行按柜台自动提交。",
    },
  },
  {
    key: "external_scan.view",
    group: "external",
    label: { vi: "Xem hàng chờ từ hệ thống ngoài", zh: "查看外部扫描队列" },
    description: {
      vi: "Xem danh sách và lịch sử hàng chờ xuất kho từ hệ thống ngoài.",
      zh: "查看来自外部系统的出库待处理列表和历史记录。",
    },
  },
  {
    key: "external_count.view",
    group: "external",
    label: { vi: "Xem kiểm đếm ngoài", zh: "查看外部盘点" },
    description: {
      vi: "Xem phiên kiểm đếm ATP theo quầy từ hệ thống ngoài.",
      zh: "查看来自外部系统的柜台ATP盘点会话。",
    },
  },
  {
    key: "external_count.count",
    group: "external",
    label: { vi: "Nhập kiểm đếm ngoài", zh: "录入外部盘点" },
    description: {
      vi: "Tạo, lưu tạm và nộp kết quả kiểm đếm ATP theo quầy.",
      zh: "创建、暂存并提交柜台ATP盘点结果。",
    },
  },
  {
    key: "external_count.cancel",
    group: "external",
    label: { vi: "Hủy phiên kiểm đếm ngoài", zh: "取消外部盘点" },
    description: {
      vi: "Hủy phiên kiểm đếm ngoài với lý do bắt buộc và audit log.",
      zh: "带必填原因和审计日志取消外部盘点。",
    },
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** All permission keys (excluding "*") for validation */
export const ALL_PERMISSION_KEYS = PERMISSION_REGISTRY.filter(
  (p) => p.key !== "*",
).map((p) => p.key);

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
