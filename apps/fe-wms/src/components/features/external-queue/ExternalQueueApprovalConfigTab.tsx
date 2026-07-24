"use client";

import { useCallback, useEffect, useState } from "react";
import {
    CheckCircle2,
    Clock3,
    Save,
    ShieldCheck,
    SlidersHorizontal,
    Store,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type {
    ApprovalLevel,
    ApprovalScopeMode,
    ProcessConfig,
    Role,
} from "@bduck/shared-types";
import { externalQueueApi } from "../../../api/externalQueueApi";
import { useRoles } from "../../../hooks/useRoles";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";

const SCOPE_OPTIONS: ApprovalScopeMode[] = ["ENTITY_WAREHOUSE", "GLOBAL"];

const emptyLevel = (level: 1 | 2): ApprovalLevel => ({
    level,
    role_id: "",
    label: {
        vi: level === 1 ? "Duyệt phiếu xuất cấp 2" : "Duyệt phiếu xuất cấp 3",
        zh: level === 1 ? "出库单二级审批" : "出库单三级审批",
    },
    required: false,
    enabled: false,
    min_approvers: 1,
    approval_scope: level === 1 ? "ENTITY_WAREHOUSE" : "GLOBAL",
    allow_global_fallback: false,
});

function getScopeLabel(scope: ApprovalScopeMode) {
    const labels: Record<ApprovalScopeMode, string> = {
        ENTITY_WAREHOUSE: "Theo kho/cửa hàng",
        SOURCE_WAREHOUSE: "Kho nguồn",
        DESTINATION_WAREHOUSE: "Kho đích",
        GLOBAL: "Toàn hệ thống",
    };
    return labels[scope];
}

function resolveBaseLevel(config: ProcessConfig | null): ApprovalLevel {
    const existing = config?.approval_chain.find((level) => level.level === 0);
    return {
        level: 0,
        role_id: existing?.role_id || "",
        label: existing?.label || {
            vi: "Duyệt hàng chờ cấp 1",
            zh: "队列一级审批",
        },
        required: true,
        enabled: true,
        min_approvers: 1,
        approval_scope: existing?.approval_scope ?? "ENTITY_WAREHOUSE",
        allow_global_fallback: existing?.allow_global_fallback === true,
    };
}

function resolveConfigLevels(config: ProcessConfig | null): ApprovalLevel[] {
    return [1, 2].map((level) => {
        const existing = config?.approval_chain.find(
            (item) => item.level === level,
        );
        return existing || emptyLevel(level as 1 | 2);
    });
}

function LevelConfigRow({
    level,
    roles,
    disabled,
    onChange,
}: {
    level: ApprovalLevel;
    roles: Pick<Role, "id" | "name">[];
    disabled: boolean;
    onChange: (level: ApprovalLevel) => void;
}) {
    const isActive = level.required || level.enabled;
    const displayLevel = level.level + 1;

    const setEnabled = (enabled: boolean) => {
        onChange({
            ...level,
            enabled,
            role_id: enabled && !level.role_id ? roles[0]?.id || "" : level.role_id,
        });
    };

    return (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isActive
                                ? "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]"
                                : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
                            }`}
                    >
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                Cấp {displayLevel}
                            </h3>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive
                                        ? "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]"
                                        : "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]"
                                    }`}
                            >
                                {isActive ? "Đang bật" : "Đang tắt"}
                            </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                            {displayLevel === 2
                                ? "Duyệt phiếu xuất sau khi cấp 1 tạo phiếu từ hàng chờ."
                                : "Cấp cuối trước khi phiếu xuất ghi nhận ảnh hưởng kho."}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setEnabled(!isActive)}
                    className={`inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isActive
                            ? "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]"
                            : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
                        }`}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    {isActive ? "Bật" : "Tắt"}
                </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,1.2fr)_minmax(150px,1fr)_120px_140px]">
                <label className="block">
                    <span className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                        Role duyệt
                    </span>
                    <select
                        value={level.role_id}
                        disabled={disabled || !isActive}
                        onChange={(event) =>
                            onChange({ ...level, role_id: event.target.value })
                        }
                        className="mt-1 h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-brand-primary)] disabled:bg-[var(--color-surface-subtle)]"
                    >
                        <option value="">Chọn role</option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                        Phạm vi
                    </span>
                    <select
                        value={level.approval_scope ?? "ENTITY_WAREHOUSE"}
                        disabled={disabled || !isActive}
                        onChange={(event) =>
                            onChange({
                                ...level,
                                approval_scope: event.target.value as ApprovalScopeMode,
                            })
                        }
                        className="mt-1 h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-brand-primary)] disabled:bg-[var(--color-surface-subtle)]"
                    >
                        {SCOPE_OPTIONS.map((scope) => (
                            <option key={scope} value={scope}>
                                {getScopeLabel(scope)}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                        Số người
                    </span>
                    <input
                        type="number"
                        min={1}
                        max={5}
                        value={level.min_approvers || 1}
                        disabled={disabled || !isActive}
                        onChange={(event) =>
                            onChange({
                                ...level,
                                min_approvers: Math.max(
                                    1,
                                    Number.parseInt(event.target.value, 10) || 1,
                                ),
                            })
                        }
                        className="mt-1 h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-brand-primary)] disabled:bg-[var(--color-surface-subtle)]"
                    />
                </label>

                <label className="flex items-end gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                    <input
                        type="checkbox"
                        checked={level.allow_global_fallback === true}
                        disabled={disabled || !isActive}
                        onChange={(event) =>
                            onChange({
                                ...level,
                                allow_global_fallback: event.target.checked,
                            })
                        }
                        className="mb-2 h-4 w-4 rounded border-[var(--color-border-subtle)]"
                    />
                    <span className="pb-2">Cho phép role global</span>
                </label>
            </div>
        </div>
    );
}

export default function ExternalQueueApprovalConfigTab() {
    const { t } = useTranslation();
    const externalQueueText = (t as any).externalQueue;
    const approvalText = externalQueueText?.approvalConfigTab || {};
    const { warehouses, loading: warehousesLoading } = useWarehouses();
    const { roles, isLoading: rolesLoading } = useRoles();
    const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
    const [baseLevel, setBaseLevel] = useState<ApprovalLevel>(() =>
        resolveBaseLevel(null),
    );
    const [configLevels, setConfigLevels] = useState<ApprovalLevel[]>([
        emptyLevel(1),
        emptyLevel(2),
    ]);
    const [autoApprove, setAutoApprove] = useState(true);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!selectedWarehouseId && warehouses[0]) {
            setSelectedWarehouseId(warehouses[0].id);
        }
    }, [selectedWarehouseId, warehouses]);

    const selectedWarehouse = warehouses.find(
        (warehouse) => warehouse.id === selectedWarehouseId,
    );

    const loadConfig = useCallback(async () => {
        if (!selectedWarehouseId) return;
        try {
            setLoadingConfig(true);
            const response = await externalQueueApi.getApprovalConfig({
                warehouse_id: selectedWarehouseId,
            });
            setBaseLevel(resolveBaseLevel(response.data));
            setAutoApprove(response.data.auto_approve);
            setConfigLevels(resolveConfigLevels(response.data));
        } catch (error) {
            console.error("[ExternalQueueApprovalConfigTab] load failed", error);
            gooeyToast.error(
                approvalText.loadError || "Không thể tải cấu hình cấp duyệt.",
                { preset: "snappy" },
            );
        } finally {
            setLoadingConfig(false);
        }
    }, [approvalText.loadError, selectedWarehouseId]);

    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    const activeAdditionalLevels = configLevels.filter(
        (level) => level.required || level.enabled,
    );
    const totalApprovalLevels = autoApprove
        ? 1
        : 1 + activeAdditionalLevels.length;

    const updateLevel = (updated: ApprovalLevel) => {
        setConfigLevels((current) =>
            current.map((level) => (level.level === updated.level ? updated : level)),
        );
    };

    const validate = () => {
        if (!baseLevel.role_id) {
            gooeyToast.error(
                approvalText.missingBaseRole || "Hãy chọn role duyệt cho cấp 1.",
                { preset: "snappy" },
            );
            return false;
        }

        if (!autoApprove && activeAdditionalLevels.length === 0) {
            gooeyToast.error(
                approvalText.missingLevel ||
                "Hãy bật ít nhất cấp 2 hoặc chọn chỉ cần cấp 1.",
                { preset: "snappy" },
            );
            return false;
        }

        if (
            !autoApprove &&
            configLevels.some(
                (level) => (level.required || level.enabled) && !level.role_id,
            )
        ) {
            gooeyToast.error(
                approvalText.missingRole || "Hãy chọn role cho cấp duyệt đang bật.",
                { preset: "snappy" },
            );
            return false;
        }

        const level2Active = configLevels.some(
            (level) => level.level === 1 && (level.required || level.enabled),
        );
        const level3Active = configLevels.some(
            (level) => level.level === 2 && (level.required || level.enabled),
        );
        if (!autoApprove && level3Active && !level2Active) {
            gooeyToast.error(
                approvalText.invalidOrder || "Cấp 3 chỉ được bật sau khi bật cấp 2.",
                { preset: "snappy" },
            );
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        if (!selectedWarehouseId || saving || !validate()) return;

        const payloadLevels = [
            {
                ...baseLevel,
                role_id: baseLevel.role_id.trim(),
                min_approvers: Math.max(baseLevel.min_approvers || 1, 1),
                approval_scope: baseLevel.approval_scope ?? "ENTITY_WAREHOUSE",
                allow_global_fallback: baseLevel.allow_global_fallback === true,
            },
            ...configLevels.map((level) => ({
                ...level,
                required: false,
                enabled: autoApprove ? false : level.enabled,
                role_id: level.role_id.trim(),
                min_approvers: Math.max(level.min_approvers || 1, 1),
                approval_scope: level.approval_scope ?? "ENTITY_WAREHOUSE",
                allow_global_fallback: level.allow_global_fallback === true,
            })),
        ];

        const saveAction = async () => {
            setSaving(true);
            const response = await externalQueueApi.updateApprovalConfig({
                warehouse_id: selectedWarehouseId,
                auto_approve: autoApprove,
                approval_chain: payloadLevels,
            });
            setBaseLevel(resolveBaseLevel(response.data));
            setAutoApprove(response.data.auto_approve);
            setConfigLevels(resolveConfigLevels(response.data));
        };

        try {
            await gooeyToast.promise(saveAction(), {
                loading: approvalText.saving || "Đang lưu cấu hình cấp duyệt...",
                success: approvalText.saveSuccess || "Đã lưu cấu hình cấp duyệt",
                error: approvalText.saveError || "Không thể lưu cấu hình cấp duyệt",
                description: {
                    success:
                        approvalText.saveSuccessDesc ||
                        "Cấu hình duyệt external queue đã được cập nhật.",
                    error:
                        approvalText.saveErrorDesc ||
                        "Vui lòng kiểm tra quyền và dữ liệu cấu hình.",
                },
            });
        } catch (error) {
            console.error("[ExternalQueueApprovalConfigTab] save failed", error);
        } finally {
            setSaving(false);
        }
    };

    if (warehousesLoading || rolesLoading || loadingConfig) {
        return (
            <div className="grid gap-3">
                {[0, 1, 2].map((item) => (
                    <div
                        key={item}
                        className="h-24 animate-pulse rounded-lg border border-[var(--color-border-subtle)] bg-white"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <section className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                            <SlidersHorizontal className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                                {approvalText.title || "Cấu hình cấp duyệt"}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                                {approvalText.subtitle ||
                                    "Thiết lập tối đa 3 cấp duyệt cho hàng chờ quét ngoài theo từng kho/cửa hàng."}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-end">
                        <label className="block">
                            <span className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                Kho/cửa hàng
                            </span>
                            <select
                                value={selectedWarehouseId}
                                onChange={(event) => setSelectedWarehouseId(event.target.value)}
                                className="mt-1 h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-brand-primary)]"
                            >
                                {warehouses.map((warehouse) => (
                                    <option key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !selectedWarehouseId}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-success-icon)] px-4 text-sm font-semibold text-[var(--color-text-on-dark)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? (
                                <Clock3 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {saving ? "Đang lưu" : "Lưu cấu hình"}
                        </button>
                    </div>
                </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                        Kho/cửa hàng
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        <Store className="h-4 w-4 text-[var(--color-brand-primary)]" />
                        <span className="truncate">
                            {selectedWarehouse?.name || selectedWarehouseId || "-"}
                        </span>
                    </div>
                </div>
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                        Tổng cấp duyệt
                    </p>
                    <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {totalApprovalLevels}
                    </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                        Sau cấp 1
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {autoApprove ? "Ghi nhận sau cấp 1" : "Cần duyệt phiếu xuất"}
                    </p>
                </div>
            </div>

            <section className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                Cấp 1 tại /external/queue
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                                Người có quyền duyệt hàng chờ tạo phiếu xuất và chuyển sang
                                luồng duyệt phiếu xuất.
                            </p>
                            <label className="mt-3 block max-w-80">
                                <span className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                    Role duyệt
                                </span>
                                <select
                                    value={baseLevel.role_id}
                                    disabled={saving}
                                    onChange={(event) =>
                                        setBaseLevel((current) => ({
                                            ...current,
                                            role_id: event.target.value,
                                        }))
                                    }
                                    className="mt-1 h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-brand-primary)] disabled:bg-[var(--color-surface-subtle)]"
                                >
                                    <option value="">Chọn role</option>
                                    {roles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setAutoApprove((value) => !value)}
                        className={`inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition ${autoApprove
                                ? "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]"
                                : "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]"
                            }`}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {autoApprove ? "Chỉ cần cấp 1" : "Có cấp 2/3"}
                    </button>
                </div>
            </section>

            <div className="grid gap-3">
                {configLevels.map((level) => (
                    <LevelConfigRow
                        key={level.level}
                        level={level}
                        roles={roles}
                        disabled={autoApprove || saving}
                        onChange={updateLevel}
                    />
                ))}
            </div>
        </div>
    );
}
