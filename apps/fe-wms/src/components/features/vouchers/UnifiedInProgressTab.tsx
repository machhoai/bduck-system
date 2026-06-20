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
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { UnifiedVoucher } from "../../../types/unified-voucher";
import { useTranslation } from "../../../lib/i18n";
import { MISC_COMPONENT_TEXT } from "../../../lib/i18n/componentTranslations";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useUsers } from "../../../hooks/useUsers";
import VoucherDetailDrawer from "../import-vouchers/VoucherDetailDrawer";
import TransferDetailDrawer from "../transfers/TransferDetailDrawer";

interface UnifiedInProgressTabProps {
    vouchers: UnifiedVoucher[];
    initialTypeFilter?: string;
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

function parseVoucherDate(value: unknown): Date | null {
    if (!value) return null;
    let date: Date;
    if (typeof (value as any).toDate === "function") date = (value as any).toDate();
    else if ((value as any)._seconds !== undefined) date = new Date((value as any)._seconds * 1000);
    else if ((value as any).seconds !== undefined) date = new Date((value as any).seconds * 1000);
    else date = new Date(value as any);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getVoucherTimestamp(voucher: UnifiedVoucher): number {
    return parseVoucherDate(voucher.created_at)?.getTime() ?? 0;
}

function formatVoucherDateTime(value: unknown): string {
    const date = parseVoucherDate(value);
    if (!date) {
        try {
            return typeof value === "string" ? value : value ? JSON.stringify(value) : "N/A";
        } catch {
            return "N/A";
        }
    }
    return format(date, "dd/MM/yyyy HH:mm", { locale: vi });
}

function getVoucherDateGroup(
    voucher: UnifiedVoucher,
    unknownDateLabel: string,
): { key: string; label: string } {
    const date = parseVoucherDate(voucher.created_at);
    if (!date) return { key: "unknown", label: unknownDateLabel };
    return {
        key: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE, dd/MM/yyyy", { locale: vi }),
    };
}

function groupVouchersByDate(vouchers: UnifiedVoucher[], unknownDateLabel: string) {
    return vouchers.reduce<Array<{ key: string; label: string; items: UnifiedVoucher[] }>>((groups, voucher) => {
        const groupInfo = getVoucherDateGroup(voucher, unknownDateLabel);
        const existing = groups.find((group) => group.key === groupInfo.key);
        if (existing) existing.items.push(voucher);
        else groups.push({ ...groupInfo, items: [voucher] });
        return groups;
    }, []);
}

export default function UnifiedInProgressTab({ vouchers, initialTypeFilter }: UnifiedInProgressTabProps) {
    const { t, lang } = useTranslation();
    const misc = MISC_COMPONENT_TEXT[lang === "zh" ? "zh" : "vi"];
    const { warehouses } = useWarehouses();
    const { users } = useUsers();

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter ?? "");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [sort, setSort] = useState<"newest" | "oldest">("newest");
    const [selectedVoucher, setSelectedVoucher] = useState<UnifiedVoucher | null>(null);
    const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

    useEffect(() => {
        setTypeFilter(initialTypeFilter ?? "");
    }, [initialTypeFilter]);

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
            list.sort((a, b) => getVoucherTimestamp(b) - getVoucherTimestamp(a));
        } else {
            list.sort((a, b) => getVoucherTimestamp(a) - getVoucherTimestamp(b));
        }

        return list;
    }, [vouchers, search, typeFilter, statusFilter, sort]);

    const groupedVouchers = useMemo(
        () => groupVouchersByDate(filteredVouchers, misc.unknownDate),
        [filteredVouchers, misc.unknownDate],
    );

    if (vouchers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
                    <PackageOpen size={24} className="text-[var(--color-text-muted)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {(t as any).vouchers?.inProgressTab?.emptyTitle || "Chưa có lệnh nào đang xử lý"}
                </p>
                <p className="w-full text-xs leading-5 text-[var(--color-text-muted)]">
                    {(t as any).vouchers?.inProgressTab?.emptyHint || "Lệnh nháp hoặc đang chờ duyệt sẽ xuất hiện ở đây."}
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
                        placeholder={(t as any).vouchers?.inProgressTab?.searchPlaceholder || "Tìm theo mã lệnh, ghi chú..."}
                        className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]"
                    />
                </div>

                {/* Type Filter */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTypeFilter("")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {(t as any).vouchers?.inProgressTab?.filterAll || "Tất cả"}
                    </button>
                    <button
                        onClick={() => setTypeFilter("IMPORT")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "IMPORT" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {(t as any).vouchers?.inProgressTab?.filterImport || misc.importWarehouse}
                    </button>
                    <button
                        onClick={(e) => setTypeFilter("EXPORT")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "EXPORT" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {(t as any).vouchers?.inProgressTab?.filterExport || misc.exportWarehouse}
                    </button>
                    <button
                        onClick={(e) => setTypeFilter("TRANSFER")}
                        className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${typeFilter === "TRANSFER" ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                        {(t as any).vouchers?.inProgressTab?.filterTransfer || misc.transfer}
                    </button>
                </div>
                {/* <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                >
                    <option value="">{misc.allTypes}</option>
                    <option value="IMPORT">{misc.importWarehouse}</option>
                    <option value="EXPORT">{misc.exportWarehouse}</option>
                    <option value="TRANSFER">{misc.transfer}</option>
                </select> */}

                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as any)}
                    className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                >
                    <option value="newest">{(t as any).vouchers?.inProgressTab?.sortNewest || "Mới nhất trước"}</option>
                    <option value="oldest">{(t as any).vouchers?.inProgressTab?.sortOldest || "Cũ nhất trước"}</option>
                </select>
            </div>

            {/* List */}
            {filteredVouchers.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                    {(t as any).vouchers?.inProgressTab?.noMatches || "Không tìm thấy lệnh phù hợp"}
                </p>
            ) : (
                <div className="flex flex-col gap-5">
                    {groupedVouchers.map((group) => (
                        <section key={group.key} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                                    {group.label}
                                </h3>
                                <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-text-muted)]">
                                    {group.items.length}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.items.map((voucher) => {
                    const typeCfg = TYPE_CONFIG[voucher.type];
                    const statusCfg = STATUS_CONFIG[voucher.status] || { bg: "bg-gray-100", text: "text-gray-600" };
                    const TypeIcon = typeCfg.icon;
                    const warehouse = warehouseById.get(voucher.warehouse_id);
                    const creator = userById.get(voucher.creator_id);

                    return (
                        <div
                            key={voucher.id}
                            onClick={() => {
                                if (voucher.type === "TRANSFER") setSelectedTransferId(voucher.id);
                                else setSelectedVoucher(voucher);
                            }}
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
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                                    {(t as any).importVoucher?.status?.[voucher.status] || (t as any).exportVoucher?.status?.[voucher.status] || voucher.status}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] p-2">
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                    <User size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                                    <span className="truncate">{creator?.full_name || voucher.creator_id}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                    <Calendar size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                                    <span>{formatVoucherDateTime(voucher.created_at)}</span>
                                </div>
                                {voucher.approver_id && (
                                    <div className="flex items-center gap-2 text-xs text-[var(--color-status-approved-text)]">
                                        <ClipboardSignature size={12} className="shrink-0" />
                                        <span className="truncate">{(t as any).vouchers?.inProgressTab?.approver || "Người duyệt: "}{userById.get(voucher.approver_id)?.full_name || voucher.approver_id}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {selectedVoucher && (
                <VoucherDetailDrawer
                    voucher={selectedVoucher.raw as any}
                    onClose={() => setSelectedVoucher(null)}
                />
            )}

            {selectedTransferId && (
                <TransferDetailDrawer
                    orderId={selectedTransferId}
                    onClose={() => setSelectedTransferId(null)}
                    readOnly
                />
            )}
        </div>
    );
}
