"use client";

import { useEffect, useMemo, useState } from "react";
import {
    PackageOpen,
    Search,
    ArrowRightCircle,
    ArrowDownCircle,
    ArrowUpCircle,
    Calendar,
    User,
    ClipboardSignature,
    Play
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { UnifiedVoucher } from "../../../types/unified-voucher";
import { useTranslation } from "../../../lib/i18n";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useUsers } from "../../../hooks/useUsers";
import { useUserStore } from "../../../stores/useUserStore";
import { fetchConfigByEntityType } from "../../../hooks/useApprovalApi";
import type { ProcessConfig } from "@bduck/shared-types";
import VoucherDetailDrawer from "../import-vouchers/VoucherDetailDrawer";
import ReceivingSessionDrawer from "../../tasks/ReceivingSessionDrawer";
import PickingSessionDrawer from "../../tasks/PickingSessionDrawer";
// import TransferSessionDrawer from "../../tasks/TransferSessionDrawer"; // If it exists, add it if needed later.

interface UnifiedInProgressTabProps {
    vouchers: UnifiedVoucher[];
    onClone: (voucherData: Record<string, unknown>) => void;
    onEdit?: (voucherData: Record<string, unknown>) => void;
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType; labelKey: string }> = {
    IMPORT: {
        bg: "bg-blue-50",
        text: "text-blue-600",
        icon: ArrowDownCircle,
        labelKey: "importVoucher",
    },
    EXPORT: {
        bg: "bg-amber-50",
        text: "text-amber-600",
        icon: ArrowUpCircle,
        labelKey: "exportVoucher",
    },
    TRANSFER: {
        bg: "bg-purple-50",
        text: "text-purple-600",
        icon: ArrowRightCircle,
        labelKey: "transfer",
    },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: "bg-[var(--color-status-draft-bg)]", text: "text-[var(--color-status-draft-text)]" },
    PENDING_APPROVAL: { bg: "bg-[var(--color-status-pending-bg)]", text: "text-[var(--color-status-pending-text)]" },
    APPROVED: { bg: "bg-[var(--color-status-approved-bg)]", text: "text-[var(--color-status-approved-text)]" },
    RECEIVING: { bg: "bg-[var(--color-status-completed-bg)]", text: "text-[var(--color-status-completed-text)]" }, // Just mapping color
    PICKING: { bg: "bg-[var(--color-status-pending-bg)]", text: "text-[var(--color-status-pending-text)]" },
    SHIPPED: { bg: "bg-[var(--color-status-approved-bg)]", text: "text-[var(--color-status-approved-text)]" },
};

export default function UnifiedInProgressTab({ vouchers, onClone, onEdit }: UnifiedInProgressTabProps) {
    const { t } = useTranslation();
    const { warehouses } = useWarehouses();
    const { users } = useUsers();

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [sort, setSort] = useState<"newest" | "oldest">("newest");
    const [selectedVoucher, setSelectedVoucher] = useState<UnifiedVoucher | null>(null);

    const user = useUserStore((state) => state.user);
    const roleIds = useUserStore((state) => state.roleIds);
    const hasPermission = useUserStore((state) => state.hasPermission);

    const [importConfig, setImportConfig] = useState<ProcessConfig | null>(null);
    const [exportConfig, setExportConfig] = useState<ProcessConfig | null>(null);
    const [receivingVoucherId, setReceivingVoucherId] = useState<string | null>(null);
    const [pickingVoucherId, setPickingVoucherId] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        Promise.all([
            fetchConfigByEntityType("IMPORT_VOUCHER").catch(() => null),
            fetchConfigByEntityType("EXPORT_VOUCHER").catch(() => null)
        ]).then(([importCfg, exportCfg]) => {
            if (!disposed) {
                if (importCfg) setImportConfig(importCfg as ProcessConfig);
                if (exportCfg) setExportConfig(exportCfg as ProcessConfig);
            }
        });
        return () => { disposed = true; };
    }, []);

    const canPerformSession = (voucher: UnifiedVoucher) => {
        if (hasPermission("admin")) return true;

        if (voucher.type === "IMPORT") {
            if (!importConfig?.step_options?.receiving) return true;
            const step = importConfig.step_options.receiving;
            if (step.assignment_mode === "CREATOR") return user?.id === voucher.creator_id;
            if (step.assignment_mode === "ROLE") return !!step.assigned_role_id && roleIds.includes(step.assigned_role_id);
            return true;
        } else if (voucher.type === "EXPORT") {
            if (!exportConfig?.step_options?.picking) return true;
            const step = exportConfig.step_options.picking;
            if (step.assignment_mode === "CREATOR") return user?.id === voucher.creator_id;
            if (step.assignment_mode === "ROLE") return !!step.assigned_role_id && roleIds.includes(step.assigned_role_id);
            return true;
        }
        return false; // Transfer or other types not handled yet
    };

    const warehouseById = useMemo(() => new Map(warehouses.map(w => [w.id, w])), [warehouses]);
    const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

    const filteredVouchers = useMemo(() => {
        let list = [...vouchers];

        if (search) {
            const lowerSearch = search.toLowerCase();
            list = list.filter(v =>
                v.voucher_number.toLowerCase().includes(lowerSearch) ||
                (v.notes && v.notes.toLowerCase().includes(lowerSearch))
            );
        }

        if (typeFilter) {
            list = list.filter(v => v.type === typeFilter);
        }

        if (statusFilter) {
            list = list.filter(v => v.status === statusFilter);
        }

        if (sort === "newest") {
            list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else {
            list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }

        return list;
    }, [vouchers, search, typeFilter, statusFilter, sort]);

    if (vouchers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
                    <PackageOpen size={24} className="text-[var(--color-text-muted)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {t.vouchers?.inProgressTab?.emptyTitle || "Chưa có lệnh nào đang xử lý"}
                </p>
                <p className="w-full text-xs leading-5 text-[var(--color-text-muted)]">
                    {t.vouchers?.inProgressTab?.emptyHint || "Lệnh nháp hoặc đang chờ duyệt sẽ xuất hiện ở đây."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t.vouchers?.inProgressTab?.searchPlaceholder || "Tìm theo mã lệnh, ghi chú..."}
                        className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]"
                    />
                </div>

                {/* Type Filter */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTypeFilter("")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {t.vouchers?.inProgressTab?.filterAll || "Tất cả"}
                    </button>
                    <button
                        onClick={() => setTypeFilter("IMPORT")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "IMPORT" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {t.vouchers?.inProgressTab?.filterImport || "Nhập kho"}
                    </button>
                    <button
                        onClick={(e) => setTypeFilter("EXPORT")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "EXPORT" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {t.vouchers?.inProgressTab?.filterExport || "Xuất kho"}
                    </button>
                    <button
                        onClick={(e) => setTypeFilter("TRANSFER")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "TRANSFER" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {t.vouchers?.inProgressTab?.filterTransfer || "Điều chuyển"}
                    </button>
                </div>
                {/* <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                >
                    <option value="">Tất cả loại</option>
                    <option value="IMPORT">Nhập kho</option>
                    <option value="EXPORT">Xuất kho</option>
                    <option value="TRANSFER">Điều chuyển</option>
                </select> */}

                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as any)}
                    className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                >
                    <option value="newest">{t.vouchers?.inProgressTab?.sortNewest || "Mới nhất trước"}</option>
                    <option value="oldest">{t.vouchers?.inProgressTab?.sortOldest || "Cũ nhất trước"}</option>
                </select>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredVouchers.map((voucher) => {
                    const typeCfg = TYPE_CONFIG[voucher.type];
                    const statusCfg = STATUS_CONFIG[voucher.status] || { bg: "bg-gray-100", text: "text-gray-600" };
                    const TypeIcon = typeCfg.icon;
                    const warehouse = warehouseById.get(voucher.warehouse_id);
                    const creator = userById.get(voucher.creator_id);

                    return (
                        <div
                            key={voucher.id}
                            onClick={() => setSelectedVoucher(voucher)}
                            className="flex cursor-pointer flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 shadow-sm transition-all hover:border-[var(--color-border-focus)] hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${typeCfg.bg} ${typeCfg.text}`}>
                                        <TypeIcon size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                            {voucher.voucher_number}
                                        </h3>
                                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mt-0.5">
                                            <span>{warehouse?.name || (t as any).vouchers?.inProgressTab?.unknownWarehouse || "Kho không xác định"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                                        {(t as any).importVoucher?.status?.[voucher.status] || (t as any).exportVoucher?.status?.[voucher.status] || voucher.status}
                                    </span>
                                    {voucher.status === "APPROVED" && canPerformSession(voucher) && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (voucher.type === "IMPORT") {
                                                    setReceivingVoucherId(voucher.id);
                                                } else if (voucher.type === "EXPORT") {
                                                    setPickingVoucherId(voucher.id);
                                                }
                                            }}
                                            className="flex h-6 items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-success-icon)] px-2 text-xxs font-semibold text-[var(--color-text-on-dark)] transition-colors hover:opacity-90"
                                            title="Tiếp tục"
                                        >
                                            <Play size={12} />
                                            <span>Tiếp tục</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] p-2">
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                    <User size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                                    <span className="truncate">{creator?.full_name || voucher.creator_id}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                    <Calendar size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                                    <span>
                                        {(() => {
                                            const dVal = voucher.created_at;
                                            if (!dVal) return "N/A";
                                            let d: Date;
                                            if (typeof (dVal as any).toDate === 'function') d = (dVal as any).toDate();
                                            else if ((dVal as any)._seconds !== undefined) d = new Date((dVal as any)._seconds * 1000);
                                            else if ((dVal as any).seconds !== undefined) d = new Date((dVal as any).seconds * 1000);
                                            else d = new Date(dVal as any);
                                            
                                            if (isNaN(d.getTime())) {
                                                try {
                                                    return typeof dVal === 'string' ? dVal : JSON.stringify(dVal);
                                                } catch {
                                                    return "N/A";
                                                }
                                            }
                                            return format(d, "dd/MM/yyyy HH:mm", { locale: vi });
                                        })()}
                                    </span>
                                </div>
                                {voucher.approver_id && (
                                    <div className="flex items-center gap-2 text-xs text-[var(--color-status-approved-text)]">
                                        <ClipboardSignature size={12} className="shrink-0" />
                                        <span className="truncate">{t.vouchers?.inProgressTab?.approver || "Người duyệt: "}{userById.get(voucher.approver_id)?.full_name || voucher.approver_id}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedVoucher && (
                <VoucherDetailDrawer
                    voucher={selectedVoucher.raw as any}
                    onClose={() => setSelectedVoucher(null)}
                    onClone={onClone}
                    onEdit={onEdit}
                />
            )}

            {receivingVoucherId &&
                (() => {
                    const voucher = vouchers.find(
                        (item) => item.id === receivingVoucherId,
                    );
                    if (!voucher) return null;
                    return (
                        <ReceivingSessionDrawer
                            task={
                                {
                                    id: `receiving-${voucher.id}`,
                                    instance_id: voucher.id,
                                    entity_id: voucher.id,
                                    entity_type: "IMPORT_VOUCHER",
                                    voucher_id: voucher.id,
                                } as any
                            }
                            onClose={() => setReceivingVoucherId(null)}
                        />
                    );
                })()}

            {pickingVoucherId &&
                (() => {
                    const voucher = vouchers.find(
                        (item) => item.id === pickingVoucherId,
                    );
                    if (!voucher) return null;
                    return (
                        <PickingSessionDrawer
                            voucherId={voucher.id}
                            onClose={() => setPickingVoucherId(null)}
                        />
                    );
                })()}
        </div>
    );
}
