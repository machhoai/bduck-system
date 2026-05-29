"use client";

/**
 * ProcessConfigPage — Admin UI for managing pipeline configurations
 *
 * REPLACES: /workflows page (DAG canvas builder)
 *
 * DESIGN:
 * - Lists business entity types (Import Voucher, Export Voucher, etc.)
 * - Click entity → Accordion reveals fixed pipeline stages
 * - For APPROVAL stage → manage approval_chain (add/remove/toggle levels)
 * - react-hook-form + zod for validation
 *
 * LUẬT THÉP:
 * - Light Theme only
 * - Skeleton loading
 * - gooeyToast for mutations
 * - i18n (vi + zh)
 * - Tailwind CSS only
 */

import { useEffect, useState, useCallback } from "react";
import {
    FolderSymlink,
    ChevronDown,
    ChevronRight,
    Shield,
    Package,
    Plus,
    Trash2,
    Loader2,
    Save,
    ToggleLeft,
    ToggleRight,
    AlertTriangle,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ProcessConfig, ApprovalLevel } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { fetchAllConfigs, updateProcessConfig, seedProcessConfig } from "@/hooks/useApprovalApi";
import { useRoles } from "@/hooks/useRoles";

// ── Entity type labels ──
const ENTITY_LABELS: Record<string, { vi: string; zh: string; icon: React.ElementType }> = {
    IMPORT_VOUCHER: { vi: "Phiếu nhập kho", zh: "入库单", icon: Package },
    EXPORT_VOUCHER: { vi: "Phiếu xuất kho", zh: "出库单", icon: Package },
    TRANSFER_ORDER: { vi: "Lệnh chuyển kho", zh: "调拨单", icon: Package },
    PURCHASE_ORDER: { vi: "Đơn mua hàng", zh: "采购单", icon: Package },
    ADJUSTMENT_VOUCHER: { vi: "Phiếu điều chỉnh", zh: "调整单", icon: Package },
    GIFT_SESSION: { vi: "Phiên quà tặng", zh: "礼品会话", icon: Package },
};

// ── Skeleton ──
function ConfigSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-white p-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gray-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 rounded bg-gray-200" />
                            <div className="h-3 w-48 rounded bg-gray-100" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Approval Level Row ──
function ApprovalLevelRow({
    level,
    roles,
    isLang,
    onUpdate,
    onRemove,
    canRemove,
}: {
    level: ApprovalLevel;
    roles: Array<{ id: string; name: string }>;
    isLang: "vi" | "zh";
    onUpdate: (updated: ApprovalLevel) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
            {/* Level number */}
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                {level.level + 1}
            </div>

            {/* Role select */}
            <select
                value={level.role_id}
                onChange={(e) => onUpdate({ ...level, role_id: e.target.value })}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
                <option value="">{isLang === "vi" ? "— Chọn role —" : "— 选择角色 —"}</option>
                {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                ))}
            </select>

            {/* Label input */}
            <input
                type="text"
                value={level.label[isLang]}
                onChange={(e) =>
                    onUpdate({
                        ...level,
                        label: { ...level.label, [isLang]: e.target.value },
                    })
                }
                placeholder={isLang === "vi" ? "Tên bước duyệt" : "审批步骤名"}
                className="w-36 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            {/* Enabled toggle */}
            <button
                type="button"
                onClick={() => onUpdate({ ...level, enabled: !level.enabled })}
                className="flex-shrink-0"
                title={level.enabled ? "Bật" : "Tắt"}
            >
                {level.enabled ? (
                    <ToggleRight className="h-6 w-6 text-emerald-500" />
                ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-300" />
                )}
            </button>

            {/* Required badge */}
            {level.required && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    {isLang === "vi" ? "Bắt buộc" : "必需"}
                </span>
            )}

            {/* Remove */}
            <button
                type="button"
                onClick={onRemove}
                disabled={!canRemove}
                className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}

// ── Config Card (expandable) ──
function ConfigCard({
    config,
    roles,
    isLang,
    onSave,
}: {
    config: ProcessConfig;
    roles: Array<{ id: string; name: string }>;
    isLang: "vi" | "zh";
    onSave: (configId: string, chain: ApprovalLevel[]) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [chain, setChain] = useState<ApprovalLevel[]>(config.approval_chain || []);
    const [saving, setSaving] = useState(false);

    const entityMeta = ENTITY_LABELS[config.entity_type] || {
        vi: config.entity_type,
        zh: config.entity_type,
        icon: Package,
    };
    const IconComp = entityMeta.icon;

    const handleUpdateLevel = useCallback((idx: number, updated: ApprovalLevel) => {
        setChain((prev) => prev.map((l, i) => (i === idx ? updated : l)));
    }, []);

    const handleRemoveLevel = useCallback((idx: number) => {
        setChain((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            // Recalculate level numbers
            return next.map((l, i) => ({ ...l, level: i }));
        });
    }, []);

    const handleAddLevel = useCallback(() => {
        setChain((prev) => [
            ...prev,
            {
                level: prev.length,
                role_id: "",
                label: { vi: "", zh: "" },
                required: false,
                enabled: true,
                min_approvers: 1,
            },
        ]);
    }, []);

    const handleSave = useCallback(async () => {
        // Validate: all levels must have a role_id
        const invalid = chain.some((l) => !l.role_id);
        if (invalid) {
            gooeyToast.error(isLang === "vi" ? "Vui lòng chọn role cho tất cả cấp duyệt" : "请为所有审批级别选择角色", {
                preset: "snappy",
                timing: { displayDuration: 4000 },
            });
            return;
        }
        setSaving(true);
        try {
            await onSave(config.id, chain);
        } finally {
            setSaving(false);
        }
    }, [config.id, chain, onSave, isLang]);

    const enabledCount = chain.filter((l) => l.required || l.enabled).length;

    return (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <IconComp className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{entityMeta[isLang]}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                        {enabledCount} {isLang === "vi" ? "cấp duyệt đang bật" : "个启用的审批级别"}
                        {config.warehouse_id && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium">
                                Warehouse: {config.warehouse_id.slice(0, 8)}
                            </span>
                        )}
                    </p>
                </div>
                {expanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                    {/* Approval chain section */}
                    <div className="mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-500" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                            {isLang === "vi" ? "Chuỗi phê duyệt" : "审批链"}
                        </h3>
                    </div>

                    {chain.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                            {isLang === "vi" ? "Chưa có cấp duyệt nào." : "尚未设置审批级别。"}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {chain.map((level, idx) => (
                                <ApprovalLevelRow
                                    key={`${config.id}-level-${idx}`}
                                    level={level}
                                    roles={roles}
                                    isLang={isLang}
                                    onUpdate={(updated) => handleUpdateLevel(idx, updated)}
                                    onRemove={() => handleRemoveLevel(idx)}
                                    canRemove={!level.required}
                                />
                            ))}
                        </div>
                    )}

                    {/* Add level + Save */}
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleAddLevel}
                            className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {isLang === "vi" ? "Thêm cấp duyệt" : "添加审批级别"}
                        </button>

                        <div className="flex-1" />

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            {isLang === "vi" ? "Lưu cấu hình" : "保存配置"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Page ──
export default function ProcessConfigPage() {
    const { t, lang } = useTranslation();
    const isLang = (lang || "vi") as "vi" | "zh";
    const { roles } = useRoles();
    const [configs, setConfigs] = useState<ProcessConfig[]>([]);
    const [loading, setLoading] = useState(true);

    // Load configs
    useEffect(() => {
        let disposed = false;
        (async () => {
            try {
                const data = await fetchAllConfigs();
                if (!disposed) setConfigs(data as ProcessConfig[]);
            } catch (err) {
                console.error("[ProcessConfigPage] load error:", err);
            } finally {
                if (!disposed) setLoading(false);
            }
        })();
        return () => { disposed = true; };
    }, []);

    // Seed default config
    const handleSeed = useCallback(async (entityType: string) => {
        const seedAction = async () => {
            const result = await seedProcessConfig(entityType);
            setConfigs((prev) => {
                const exists = prev.some((c) => c.entity_type === entityType);
                if (exists) return prev;
                return [...prev, result as ProcessConfig];
            });
        };

        await gooeyToast.promise(seedAction(), {
            loading: isLang === "vi" ? "Đang tạo cấu hình..." : "正在创建配置...",
            success: isLang === "vi" ? "Đã tạo cấu hình mặc định" : "已创建默认配置",
            error: isLang === "vi" ? "Lỗi tạo cấu hình" : "创建配置失败",
            description: {
                error: isLang === "vi" ? "Vui lòng thử lại." : "请重试。",
            },
        });
    }, [isLang]);

    // Save config
    const handleSave = useCallback(async (configId: string, chain: ApprovalLevel[]) => {
        const saveAction = async () => {
            await updateProcessConfig(configId, { approval_chain: chain });
        };

        await gooeyToast.promise(saveAction(), {
            loading: isLang === "vi" ? "Đang lưu..." : "保存中...",
            success: isLang === "vi" ? "Đã lưu cấu hình" : "配置已保存",
            error: isLang === "vi" ? "Lỗi lưu cấu hình" : "保存失败",
            description: {
                success: isLang === "vi" ? "Chuỗi phê duyệt đã được cập nhật." : "审批链已更新。",
                error: isLang === "vi" ? "Vui lòng thử lại." : "请重试。",
            },
            action: {
                error: {
                    label: isLang === "vi" ? "Thử lại" : "重试",
                    onClick: () => handleSave(configId, chain),
                },
            },
        });
    }, [isLang]);

    // Determine which entity types don't have a config yet
    const existingTypes = new Set<string>(configs.map((c) => c.entity_type));
    const missingTypes = Object.keys(ENTITY_LABELS).filter((t) => !existingTypes.has(t));

    const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

    return (
        <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                    <FolderSymlink className="h-5.5 w-5.5 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">
                        {t.nav?.processConfigs || "Cấu hình quy trình"}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {isLang === "vi"
                            ? "Quản lý chuỗi phê duyệt cho từng loại chứng từ"
                            : "管理每种单据的审批链"}
                    </p>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <ConfigSkeleton />
            ) : (
                <div className="space-y-3">
                    {configs.map((config) => (
                        <ConfigCard
                            key={config.id}
                            config={config}
                            roles={roleOptions}
                            isLang={isLang}
                            onSave={handleSave}
                        />
                    ))}

                    {/* Seed missing configs */}
                    {missingTypes.length > 0 && (
                        <div className="mt-6">
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                {isLang === "vi" ? "Chưa có cấu hình" : "尚未配置"}
                            </h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {missingTypes.map((type) => {
                                    const meta = ENTITY_LABELS[type];
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleSeed(type)}
                                            className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/30"
                                        >
                                            <Plus className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">{meta[isLang]}</p>
                                                <p className="text-xs text-gray-400">
                                                    {isLang === "vi" ? "Tạo cấu hình mặc định" : "创建默认配置"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
