"use client";

import { useMemo, useState } from "react";
import {
    CheckCircle,
    Copy,
    Eye,
    PackageMinus,
    Search,
    XCircle,
} from "lucide-react";
import type { ExportVoucher } from "@bduck/shared-types";
import { ExportVoucherStatus } from "@bduck/shared-types";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";
import ExportVoucherDetailDrawer from "./ExportVoucherDetailDrawer";

interface Props {
    vouchers: ExportVoucher[];
    onClone: (data: Record<string, unknown>) => void;
}

type SortKey = "newest" | "oldest" | "voucher";

const STATUS_KEYS = ["COMPLETED", "CANCELLED"] as const;

const STATUS_CONFIG: Record<
    string,
    { bg: string; text: string; Icon: React.ElementType }
> = {
    COMPLETED: { bg: "bg-[var(--color-status-completed-bg)]", text: "text-[var(--color-status-completed-text)]", Icon: CheckCircle },
    CANCELLED: { bg: "bg-[var(--color-status-draft-bg)]", text: "text-[var(--color-status-draft-text)]", Icon: XCircle },
};

function formatDate(value: unknown): string {
    if (!value) return "";
    const date =
        typeof value === "string"
            ? new Date(value)
            : ((value as { toDate?: () => Date })?.toDate?.() ?? (value as Date));
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getTimestamp(value: unknown): number {
    if (!value) return 0;
    const date =
        typeof value === "string"
            ? new Date(value)
            : ((value as { toDate?: () => Date })?.toDate?.() ?? (value as Date));
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
    return date.getTime();
}

function getClonePayload(voucher: ExportVoucher) {
    return {
        warehouse_id: voucher.warehouse_id,
        export_type: voucher.export_type,
        recipient_name: voucher.recipient_name,
        recipient_department: voucher.recipient_department,
        destination_warehouse_id: voucher.recipient_department,
        reference_id: voucher.reference_id,
        reference_type: voucher.reference_type,
        notes: voucher.notes,
    };
}

export default function ExportHistoryTab({ vouchers, onClone }: Props) {
    const { t } = useTranslation();
    const exportText = t.exportVoucher as any;
    const { warehouses } = useWarehouses();

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("");
    const [sort, setSort] = useState<SortKey>("newest");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const warehouseById = useMemo(
        () => new Map(warehouses.map((wh) => [wh.id, wh])),
        [warehouses],
    );

    const filtered = useMemo(() => {
        let list = vouchers.filter((v) => {
            if (search) {
                const searchable = [
                    v.voucher_number,
                    v.recipient_name,
                    v.recipient_department,
                    v.export_type,
                    v.warehouse_id,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!searchable.includes(search.toLowerCase())) return false;
            }
            if (statusFilter && v.status !== statusFilter) return false;
            if (warehouseFilter && v.warehouse_id !== warehouseFilter) return false;
            return true;
        });

        list = [...list].sort((a, b) => {
            if (sort === "newest") return getTimestamp(b.created_at) - getTimestamp(a.created_at);
            if (sort === "oldest") return getTimestamp(a.created_at) - getTimestamp(b.created_at);
            return a.voucher_number.localeCompare(b.voucher_number);
        });

        return list;
    }, [vouchers, search, statusFilter, warehouseFilter, sort]);

    // Unique warehouses for the dropdown
    const usedWarehouses = useMemo(() => {
        const ids = [...new Set(vouchers.map((v) => v.warehouse_id))];
        return ids
            .map((id) => warehouseById.get(id))
            .filter(Boolean) as typeof warehouses;
    }, [vouchers, warehouseById]);

    if (vouchers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
                    <PackageMinus size={24} className="text-[var(--color-text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">
                    {exportText.historyEmpty}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                    <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={exportText.filter?.searchPlaceholder ?? exportText.historySearchPlaceholder}
                        className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]"
                    />
                </div>

                {/* Status chips */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setStatusFilter("")}
                        className={`h-6 shrink-0 rounded-full px-2 text-xxs font-semibold transition-colors ${
                            !statusFilter
                                ? "bg-[var(--color-status-export-icon)] text-[var(--color-text-on-dark)]"
                                : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
                        }`}
                    >
                        {exportText.filter?.allStatuses ?? "Tat ca"}
                    </button>
                    {STATUS_KEYS.map((key) => {
                        const cfg = STATUS_CONFIG[key];
                        const label = exportText.status?.[key] ?? key;
                        const isActive = statusFilter === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() =>
                                    setStatusFilter(isActive ? "" : key)
                                }
                                className={`h-6 shrink-0 rounded-full px-2 text-xxs font-semibold transition-colors ${
                                    isActive
                                        ? `${cfg.bg} ${cfg.text}`
                                        : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Warehouse dropdown */}
                {usedWarehouses.length > 1 && (
                    <select
                        value={warehouseFilter}
                        onChange={(e) => setWarehouseFilter(e.target.value)}
                        className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    >
                        <option value="">{exportText.filter?.warehouse ?? "Kho"}</option>
                        {usedWarehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>
                                {wh.name}
                            </option>
                        ))}
                    </select>
                )}

                {/* Sort */}
                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                >
                    <option value="newest">{exportText.filter?.newestFirst ?? "Moi nhat"}</option>
                    <option value="oldest">{exportText.filter?.oldestFirst ?? "Cu nhat"}</option>
                    <option value="voucher">{exportText.filter?.voucherAsc ?? "Ma phieu"}</option>
                </select>

                {/* Clear filters */}
                {(search || statusFilter || warehouseFilter) && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearch("");
                            setStatusFilter("");
                            setWarehouseFilter("");
                        }}
                        className="h-6 px-2 text-xxs font-medium text-[var(--color-status-export-text)] hover:underline"
                    >
                        {exportText.filter?.clearFilters}
                    </button>
                )}
            </div>

            {/* Results count */}
            <p className="text-xxs text-[var(--color-text-muted)]">
                {filtered.length}/{vouchers.length} {exportText.filter?.results ?? "ket qua"}
            </p>

            {/* Voucher list */}
            {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                    {exportText.filter?.noMatches}
                </p>
            ) : (
                <div className="flex flex-col gap-1">
                    {filtered.map((voucher) => {
                        const warehouse = warehouseById.get(voucher.warehouse_id);
                        const isCompleted = voucher.status === ExportVoucherStatus.COMPLETED;
                        const statusLabel = exportText.status?.[voucher.status] ?? voucher.status;
                        const cfg = STATUS_CONFIG[voucher.status] ?? STATUS_CONFIG.CANCELLED;
                        const StatusIcon = cfg.Icon;

                        return (
                            <div
                                key={voucher.id}
                                className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2 transition-colors hover:bg-[var(--color-surface-card)]"
                            >
                                {/* Status icon */}
                                <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg} ${cfg.text}`}
                                >
                                    <StatusIcon size={16} />
                                </div>

                                {/* Main info */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                                            {voucher.voucher_number}
                                        </span>
                                        <span
                                            className={`inline-flex rounded-full px-1.5 py-0.5 text-micro font-semibold ${cfg.bg} ${cfg.text}`}
                                        >
                                            {statusLabel}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-[var(--color-text-secondary)] truncate">
                                            {voucher.recipient_name || voucher.export_type}
                                            {voucher.recipient_department
                                                ? ` / ${voucher.recipient_department}`
                                                : ""}
                                        </span>
                                        {warehouse && (
                                            <span className="text-xxs text-[var(--color-text-muted)] truncate">
                                                {warehouse.name}
                                                {warehouse.code ? ` (${warehouse.code})` : ""}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Date */}
                                <span className="hidden shrink-0 text-xxs tabular-nums text-[var(--color-text-muted)] sm:block">
                                    {formatDate(voucher.created_at)}
                                </span>

                                {/* Actions */}
                                <div className="flex shrink-0 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(voucher.id)}
                                        className="flex h-6 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 text-xxs font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
                                        title={exportText.actions?.viewDetail}
                                    >
                                        <Eye size={12} />
                                        <span className="hidden lg:inline">{exportText.actions?.viewDetail}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onClone(getClonePayload(voucher))}
                                        className="flex h-6 items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-status-export-bg)] px-2 text-xxs font-semibold text-[var(--color-status-export-text)] transition-colors hover:bg-[var(--color-status-export-bg-muted)]"
                                        title={exportText.actions?.clone}
                                    >
                                        <Copy size={12} />
                                        <span className="hidden lg:inline">{exportText.actions?.clone}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail drawer */}
            {selectedId && (
                <ExportVoucherDetailDrawer
                    voucherId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </div>
    );
}
