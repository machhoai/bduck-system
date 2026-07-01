"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { Role } from "@bduck/shared-types";
import {
    PERMISSION_GROUPS,
    PERMISSION_REGISTRY,
    type PermissionDefinition,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface RoleFormModalProps {
    isOpen: boolean;
    role: Role | null;
    roles: Role[];
    onClose: () => void;
    onSave: (payload: unknown) => Promise<unknown>;
}

interface PermissionSectionDefinition {
    id: string;
    label: { vi: string; zh: string };
    description: { vi: string; zh: string };
    keys: string[];
}

interface PermissionPageDefinition {
    id: string;
    label: { vi: string; zh: string };
    description: { vi: string; zh: string };
    sections: PermissionSectionDefinition[];
}

interface PermissionPageView {
    id: string;
    label: string;
    description: string;
    sections: Array<{
        id: string;
        label: string;
        description: string;
        permissions: PermissionDefinition[];
    }>;
    permissions: PermissionDefinition[];
}

const PERMISSION_PAGE_DEFINITIONS: PermissionPageDefinition[] = [
    {
        id: "system",
        label: { vi: "Hệ thống", zh: "系统" },
        description: {
            vi: "Quyền cấp cao áp dụng toàn bộ hệ thống.",
            zh: "适用于整个系统的高级权限。",
        },
        sections: [
            {
                id: "admin",
                label: { vi: "Quản trị toàn hệ thống", zh: "全系统管理" },
                description: {
                    vi: "Chỉ cấp cho tài khoản chịu trách nhiệm quản trị cao nhất.",
                    zh: "仅授予最高级系统管理员账户。",
                },
                keys: ["*"],
            },
        ],
    },
    {
        id: "products",
        label: { vi: "Trang Sản phẩm", zh: "产品页面" },
        description: {
            vi: "Quản lý danh mục, sản phẩm, BOM và thông tin giá.",
            zh: "管理分类、产品、BOM 和价格信息。",
        },
        sections: [
            {
                id: "catalog",
                label: { vi: "Danh sách sản phẩm", zh: "产品列表" },
                description: {
                    vi: "Xem, tạo, sửa sản phẩm và cấu trúc BOM.",
                    zh: "查看、创建、编辑产品和 BOM 结构。",
                },
                keys: ["products.read", "products.write"],
            },
            {
                id: "price",
                label: { vi: "Thông tin giá", zh: "价格信息" },
                description: {
                    vi: "Kiểm soát việc nhìn thấy đơn giá trên các màn hình.",
                    zh: "控制各页面中单价的可见性。",
                },
                keys: ["products.price.view"],
            },
            {
                id: "categories",
                label: { vi: "Danh mục sản phẩm", zh: "产品分类" },
                description: {
                    vi: "Xem và chỉnh cây danh mục dùng để phân loại sản phẩm.",
                    zh: "查看并维护用于产品分类的分类树。",
                },
                keys: [
                    "category.read",
                    "category.create",
                    "category.update",
                    "category.delete",
                ],
            },
        ],
    },
    {
        id: "warehouses",
        label: { vi: "Trang Kho hàng", zh: "仓库页面" },
        description: {
            vi: "Quản lý kho, vị trí, tồn kho và tổ chức liên quan.",
            zh: "管理仓库、库位、库存和相关组织。",
        },
        sections: [
            {
                id: "warehouses",
                label: { vi: "Danh sách và chi tiết kho", zh: "仓库列表与详情" },
                description: {
                    vi: "Xem và cập nhật thông tin kho, bản đồ, trạng thái và người quản lý.",
                    zh: "查看并更新仓库信息、地图、状态和负责人。",
                },
                keys: ["warehouses.read", "warehouses.write"],
            },
            {
                id: "locations",
                label: { vi: "Vị trí trong kho", zh: "仓库库位" },
                description: {
                    vi: "Xem, chỉnh sửa vị trí lưu trữ và thao tác cách ly.",
                    zh: "查看、编辑存储位置并执行隔离操作。",
                },
                keys: ["locations.read", "locations.write", "locations.quarantine"],
            },
            {
                id: "inventory",
                label: { vi: "Tồn kho", zh: "库存" },
                description: {
                    vi: "Xem số lượng tồn và cập nhật bản ghi tồn kho khi cần.",
                    zh: "查看库存数量，并在需要时更新库存记录。",
                },
                keys: ["inventory.read", "inventory.write"],
            },
            {
                id: "organizations",
                label: { vi: "Tổ chức", zh: "组织" },
                description: {
                    vi: "Xem và quản lý tổ chức gắn với kho hoặc cửa hàng.",
                    zh: "查看并管理与仓库或门店关联的组织。",
                },
                keys: ["organizations.read", "organizations.write"],
            },
        ],
    },
    {
        id: "vouchers",
        label: { vi: "Trang Tạo lệnh", zh: "创建单据页面" },
        description: {
            vi: "Tạo, theo dõi và xử lý lệnh nhập, xuất, điều chuyển.",
            zh: "创建、跟踪和处理入库、出库、调拨单。",
        },
        sections: [
            {
                id: "import-export",
                label: { vi: "Lệnh nhập / lệnh xuất", zh: "入库 / 出库单" },
                description: {
                    vi: "Quyền đọc để xem danh sách; quyền tạo & sửa để dùng tab tạo lệnh nhập/xuất.",
                    zh: "读取权限用于查看列表；创建和编辑权限用于新建入库/出库单。",
                },
                keys: ["vouchers.read", "vouchers.write", "vouchers.force_cancel"],
            },
            {
                id: "transfer",
                label: { vi: "Lệnh điều chuyển", zh: "调拨单" },
                description: {
                    vi: "Cấp quyền riêng cho việc xem, tạo/sửa và nhận hàng điều chuyển.",
                    zh: "分别控制调拨单的查看、创建/编辑和接收。",
                },
                keys: ["transfers.read", "transfers.write", "transfers.receive"],
            },
            {
                id: "workflow-tasks",
                label: { vi: "Quy trình và task", zh: "流程与任务" },
                description: {
                    vi: "Thiết lập hoặc thực thi các bước phê duyệt liên quan tới lệnh.",
                    zh: "配置或执行与单据相关的审批步骤。",
                },
                keys: ["workflows.manage", "workflows.execute"],
            },
        ],
    },
    {
        id: "reports",
        label: { vi: "Trang Báo cáo", zh: "报表页面" },
        description: {
            vi: "Tạo template, chia sẻ và xuất báo cáo.",
            zh: "创建模板、共享并导出报表。",
        },
        sections: [
            {
                id: "templates",
                label: { vi: "Mẫu báo cáo", zh: "报表模板" },
                description: {
                    vi: "Xem, lưu mapping và chia sẻ template báo cáo.",
                    zh: "查看、保存映射并共享报表模板。",
                },
                keys: [
                    "reports.templates.read",
                    "reports.templates.write",
                    "reports.templates.share",
                ],
            },
            {
                id: "export",
                label: { vi: "Xuất báo cáo", zh: "导出报表" },
                description: {
                    vi: "Preview và xuất file báo cáo từ template.",
                    zh: "从模板预览并导出报表文件。",
                },
                keys: ["reports.export"],
            },
        ],
    },
    {
        id: "notifications",
        label: { vi: "Trang Thông báo", zh: "通知页面" },
        description: {
            vi: "Xem lịch sử và gửi thông báo tới người dùng.",
            zh: "查看历史记录并向用户发送通知。",
        },
        sections: [
            {
                id: "notification-actions",
                label: { vi: "Gửi và xem thông báo", zh: "发送和查看通知" },
                description: {
                    vi: "Tách riêng quyền xem lịch sử, gửi in-app và gửi email.",
                    zh: "分别控制历史查看、站内通知发送和邮件发送。",
                },
                keys: [
                    "notifications.read",
                    "notifications.send_in_app",
                    "notifications.send_email",
                ],
            },
        ],
    },
    {
        id: "identity",
        label: { vi: "Trang Người dùng & phân quyền", zh: "用户与权限页面" },
        description: {
            vi: "Quản trị tài khoản người dùng và role.",
            zh: "管理用户账户和角色。",
        },
        sections: [
            {
                id: "users",
                label: { vi: "Người dùng", zh: "用户" },
                description: {
                    vi: "Xem danh sách người dùng hoặc tạo/sửa tài khoản và gán role.",
                    zh: "查看用户列表，或创建/编辑账户并分配角色。",
                },
                keys: ["users.read", "users.write"],
            },
            {
                id: "roles",
                label: { vi: "Role và phân quyền", zh: "角色与权限" },
                description: {
                    vi: "Xem role hoặc chỉnh cấu hình quyền cho từng role.",
                    zh: "查看角色或编辑每个角色的权限配置。",
                },
                keys: ["roles.read", "roles.write"],
            },
        ],
    },
    {
        id: "expenses",
        label: { vi: "Trang Chi phí", zh: "费用页面" },
        description: {
            vi: "Xem báo cáo, nhập liệu theo nhóm chi phí và chốt kỳ.",
            zh: "查看报表、按费用组录入并结账。",
        },
        sections: [
            {
                id: "expense-view",
                label: { vi: "Xem báo cáo chi phí", zh: "查看费用报表" },
                description: {
                    vi: "Xem chi phí theo kho hoặc tổng hợp toàn hệ thống.",
                    zh: "按仓库或全系统综合查看费用。",
                },
                keys: ["expenses.read", "expenses.consolidated.view"],
            },
            {
                id: "expense-entry",
                label: { vi: "Nhập liệu chi phí", zh: "费用录入" },
                description: {
                    vi: "Cho phép từng bộ phận nhập dữ liệu chi phí thuộc phạm vi của mình.",
                    zh: "允许各部门录入其负责范围内的费用。",
                },
                keys: [
                    "expenses.operations.write",
                    "expenses.hr.write",
                    "expenses.marketing.write",
                    "expenses.merchandise.write",
                    "expenses.others.write",
                ],
            },
            {
                id: "expense-period",
                label: { vi: "Kỳ kế toán", zh: "会计期间" },
                description: {
                    vi: "Chốt hoặc mở lại kỳ chi phí đã chốt.",
                    zh: "关闭或重新打开费用期间。",
                },
                keys: ["expenses.close_period", "expenses.reopen_period"],
            },
        ],
    },
    {
        id: "revenue",
        label: { vi: "Trang Doanh thu", zh: "营收页面" },
        description: {
            vi: "Xem dashboard doanh thu JoyWorld.",
            zh: "查看 JoyWorld 营收仪表板。",
        },
        sections: [
            {
                id: "revenue-dashboard",
                label: { vi: "Dashboard doanh thu", zh: "营收仪表板" },
                description: {
                    vi: "Cho phép truy cập số liệu doanh thu và đơn hàng.",
                    zh: "允许访问营收和订单数据。",
                },
                keys: ["revenue.read"],
            },
        ],
    },
    {
        id: "audit",
        label: { vi: "Trang Audit log", zh: "审计日志页面" },
        description: {
            vi: "Truy vết thao tác và dữ liệu thay đổi trong hệ thống.",
            zh: "追踪系统操作和数据变更。",
        },
        sections: [
            {
                id: "audit-log",
                label: { vi: "Nhật ký hệ thống", zh: "系统日志" },
                description: {
                    vi: "Xem lịch sử thao tác, dữ liệu cũ/mới và người thực hiện.",
                    zh: "查看操作历史、新旧数据和执行人。",
                },
                keys: ["audit.read"],
            },
        ],
    },
    {
        id: "external",
        label: { vi: "Trang Quét mã ngoài", zh: "外部扫描页面" },
        description: {
            vi: "Duyệt hàng chờ quét mã và kiểm đếm ATP từ hệ thống ngoài.",
            zh: "处理外部系统的扫描队列和 ATP 盘点。",
        },
        sections: [
            {
                id: "external-scan",
                label: { vi: "Hàng chờ quét mã", zh: "扫描队列" },
                description: {
                    vi: "Xem, duyệt, chỉnh số lượng hoặc quản lý hàng chờ POS/Scanner.",
                    zh: "查看、审批、编辑数量或管理 POS/Scanner 队列。",
                },
                keys: [
                    "external_scan.view",
                    "external_scan.approve",
                    "external_scan.edit_quantity",
                    "external_scan.manage_queue",
                ],
            },
            {
                id: "external-count",
                label: { vi: "Kiểm đếm ngoài", zh: "外部盘点" },
                description: {
                    vi: "Xem, nhập và hủy phiên kiểm đếm ATP theo quầy.",
                    zh: "查看、录入和取消按柜台的 ATP 盘点会话。",
                },
                keys: [
                    "external_count.view",
                    "external_count.count",
                    "external_count.cancel",
                ],
            },
        ],
    },
];

/** Group permissions by product pages first, then by feature inside each page. */
function useGroupedPermissions(lang: "vi" | "zh") {
    return useMemo(() => {
        const permissionByKey = new Map(
            PERMISSION_REGISTRY.map((permission) => [permission.key, permission]),
        );
        const assignedKeys = new Set<string>();

        const pages: PermissionPageView[] = PERMISSION_PAGE_DEFINITIONS.map(
            (page) => {
                const sections = page.sections
                    .map((section) => {
                        const permissions = section.keys
                            .map((key) => permissionByKey.get(key))
                            .filter(
                                (permission): permission is PermissionDefinition =>
                                    Boolean(permission),
                            );

                        for (const permission of permissions) {
                            assignedKeys.add(permission.key);
                        }

                        return {
                            id: section.id,
                            label: section.label[lang],
                            description: section.description[lang],
                            permissions,
                        };
                    })
                    .filter((section) => section.permissions.length > 0);

                return {
                    id: page.id,
                    label: page.label[lang],
                    description: page.description[lang],
                    sections,
                    permissions: sections.flatMap((section) => section.permissions),
                };
            },
        ).filter((page) => page.permissions.length > 0);

        const fallbackSections = [...PERMISSION_GROUPS]
            .sort((a, b) => a.order - b.order)
            .map((group) => ({
                id: group.id,
                label: group.label[lang],
                description:
                    lang === "vi"
                        ? "Các quyền chưa được gắn vào nhóm trang cụ thể."
                        : "尚未归入具体页面分组的权限。",
                permissions: PERMISSION_REGISTRY.filter(
                    (permission) =>
                        permission.group === group.id &&
                        !assignedKeys.has(permission.key),
                ),
            }))
            .filter((section) => section.permissions.length > 0);

        if (fallbackSections.length > 0) {
            pages.push({
                id: "other",
                label: lang === "vi" ? "Khác" : "其他",
                description:
                    lang === "vi"
                        ? "Các quyền hệ thống chưa có nhóm trang riêng."
                        : "尚未配置独立页面分组的系统权限。",
                sections: fallbackSections,
                permissions: fallbackSections.flatMap((section) => section.permissions),
            });
        }

        return pages;
    }, [lang]);
}

export function RoleFormModal({
    isOpen,
    role,
    roles,
    onClose,
    onSave,
}: RoleFormModalProps) {
    const { t, lang } = useTranslation();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState("#0066cc");
    const [parentId, setParentId] = useState("");
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const groupedPermissions = useGroupedPermissions(lang);

    useEffect(() => {
        if (!isOpen) return;

        setName(role?.name || "");
        setDescription(role?.description || "");
        setColor(role?.color || "#0066cc");
        setParentId(role?.parent_id || "");
        setPermissions(role?.permissions || {});
        // Expand all pages that have active permissions
        const activeGroups = new Set<string>();
        if (role?.permissions) {
            for (const page of groupedPermissions) {
                if (page.permissions.some((perm) => role.permissions[perm.key])) {
                    activeGroups.add(page.id);
                }
            }
        }
        if (activeGroups.size === 0 && groupedPermissions[0]) {
            activeGroups.add(groupedPermissions[0].id);
        }
        setExpandedGroups(activeGroups);
    }, [groupedPermissions, isOpen, role]);

    if (!isOpen) return null;

    const togglePermission = (key: string) => {
        setPermissions((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((current) => {
            const next = new Set(current);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const toggleGroupAll = (groupPerms: PermissionDefinition[]) => {
        const allChecked = groupPerms.every((p) => permissions[p.key] === true);
        setPermissions((current) => {
            const next = { ...current };
            for (const p of groupPerms) {
                next[p.key] = !allChecked;
            }
            return next;
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave({
                name,
                description: description || null,
                color,
                parent_id: parentId || null,
                permissions,
                board_position: role?.board_position || null,
            });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalActive = Object.values(permissions).filter(Boolean).length;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-[90%] max-w-[90%] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                        {role ? t.rbac.editRole : t.rbac.addRole}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form
                    id="roleForm"
                    onSubmit={handleSubmit}
                    className="flex-1 space-y-4 overflow-y-auto p-5"
                >
                    <label className="block">
                        <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                            {t.rbac.roleName}
                        </span>
                        <input
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                                {t.rbac.roleColor}
                            </span>
                            <input
                                type="color"
                                value={color}
                                onChange={(event) => setColor(event.target.value)}
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-2"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                                {t.rbac.parentRole}
                            </span>
                            <select
                                value={parentId}
                                onChange={(event) => setParentId(event.target.value)}
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                            >
                                <option value="">{t.rbac.rootRole}</option>
                                {roles
                                    .filter((item) => item.id !== role?.id)
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                            {t.warehouses.descriptionField}
                        </span>
                        <textarea
                            value={description}
                            rows={3}
                            onChange={(event) => setDescription(event.target.value)}
                            className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-4 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        />
                    </label>

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {t.rbac.permissions}
                            </p>
                            <span className="rounded-full bg-[var(--color-brand-primary-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-primary)]">
                                {totalActive} {t.rbac.permissionsSelected}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {groupedPermissions.map((page) => {
                                const isExpanded = expandedGroups.has(page.id);
                                const activeCount = page.permissions.filter(
                                    (p) => permissions[p.key] === true,
                                ).length;
                                const allChecked = activeCount === page.permissions.length;

                                return (
                                    <div
                                        key={page.id}
                                        className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)]"
                                    >
                                        {/* Group Header */}
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(page.id)}
                                            className="flex w-full items-center gap-3 bg-[var(--color-surface-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-card-hover)]"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                                            ) : (
                                                <ChevronRight size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {page.label}
                                                </span>
                                                <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                                                    {page.description}
                                                </span>
                                            </span>
                                            {activeCount > 0 && (
                                                <span className="rounded-full bg-[var(--color-brand-primary)] px-2.5 py-0.5 text-xxs font-semibold text-white">
                                                    {activeCount}/{page.permissions.length}
                                                </span>
                                            )}
                                        </button>

                                        {/* Expanded Permissions */}
                                        {isExpanded && (
                                            <div className="border-t border-[var(--color-border-soft)] bg-white">
                                                {/* Toggle All */}
                                                <label className="flex items-center gap-3 border-b border-dashed border-[var(--color-border-soft)] px-4 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={allChecked}
                                                        onChange={() => toggleGroupAll(page.permissions)}
                                                        className="h-4 w-4 rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)]"
                                                    />
                                                    <span className="text-xs font-semibold text-[var(--color-brand-primary)]">
                                                        {t.rbac.toggleAll}
                                                    </span>
                                                </label>

                                                {/* Individual Permissions */}
                                                <div className="divide-y divide-[var(--color-border-soft)]">
                                                    {page.sections.map((section) => {
                                                        const sectionActiveCount = section.permissions.filter(
                                                            (perm) => permissions[perm.key] === true,
                                                        ).length;
                                                        const sectionAllChecked =
                                                            sectionActiveCount === section.permissions.length;

                                                        return (
                                                            <section key={section.id} className="px-4 py-3">
                                                                <div className="mb-3 flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                                            {section.label}
                                                                        </h3>
                                                                        <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">
                                                                            {section.description}
                                                                        </p>
                                                                    </div>
                                                                    <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--color-brand-primary)]">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={sectionAllChecked}
                                                                            onChange={() => toggleGroupAll(section.permissions)}
                                                                            className="h-4 w-4 rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)]"
                                                                        />
                                                                        {sectionActiveCount}/{section.permissions.length}
                                                                    </label>
                                                                </div>

                                                                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                                                    {section.permissions.map((perm) => (
                                                                        <label
                                                                            key={perm.key}
                                                                            className="flex min-h-24 cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-3 transition-colors hover:bg-[var(--color-surface-card)]"
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={permissions[perm.key] === true}
                                                                                onChange={() => togglePermission(perm.key)}
                                                                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)]"
                                                                            />
                                                                            <span className="min-w-0">
                                                                                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                                                                                    {perm.label[lang]}
                                                                                </span>
                                                                                <code className="mt-1 inline-flex rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xxs text-[var(--color-text-muted)]">
                                                                                    {perm.key}
                                                                                </code>
                                                                                <span className="mt-2 block text-xs leading-relaxed text-[var(--color-text-muted)]">
                                                                                    {perm.description[lang]}
                                                                                </span>
                                                                            </span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </form>

                <div className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-8 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
                    >
                        {t.common.cancel}
                    </button>
                    <button
                        type="submit"
                        form="roleForm"
                        disabled={isSubmitting}
                        className="h-8 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                        {t.common.save}
                    </button>
                </div>
            </div>
        </div>
    );
}
