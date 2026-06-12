"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import {
    ClipboardCheck,
    Clock3,
    Eye,
    Inbox,
    PackageCheck,
    RefreshCw,
    ScanLine,
    Search,
} from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { externalQueueApi } from "../../../api/externalQueueApi";
import BatchDetailDrawer from "./BatchDetailDrawer";

const STATUS_BADGE_MAP: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    QUEUED: {
        label: "Đang quét",
        className: "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
        icon: ScanLine,
    },
    SUBMITTED: {
        label: "Chờ duyệt",
        className: "border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
        icon: ClipboardCheck,
    },
};

const safeParseDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === "string" || typeof val === "number") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === "object") {
        if ("_seconds" in val) return new Date(val._seconds * 1000);
        if ("seconds" in val) return new Date(val.seconds * 1000);
    }
    return null;
};

function formatQueueDate(value: any, pattern: string) {
    const date = safeParseDate(value);
    return date ? format(date, pattern, { locale: viLocale }) : "-";
}

function Metric({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
}) {
    return (
        <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</p>
                    <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

export default function ExternalQueuePendingTab() {
    const { t } = useTranslation();
    const externalQueueText = (t as any).externalQueue;
    const hasPermission = useUserStore((state) => state.hasPermission);
    const canApprove = hasPermission("external_scan.approve");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchBatches = useCallback(async (showRefreshing = false) => {
        try {
            if (showRefreshing) setIsRefreshing(true);
            const result = await externalQueueApi.getPendingBatches();
            if (result && result.data) {
                setData(result.data);
            }
        } catch (error) {
            console.error("Failed to fetch pending batches", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchBatches();
        const interval = setInterval(fetchBatches, 5000);
        return () => clearInterval(interval);
    }, [fetchBatches]);

    const pendingBatches = data || [];
    const filteredBatches = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) return pendingBatches;
        return pendingBatches.filter((batch: any) =>
            String(batch.batch_id || "").toLowerCase().includes(normalizedSearch) ||
            String(batch.operator_name || "").toLowerCase().includes(normalizedSearch)
        );
    }, [pendingBatches, searchTerm]);

    const submittedCount = pendingBatches.filter((batch: any) => batch.status === "SUBMITTED").length;
    const draftCount = pendingBatches.filter((batch: any) => batch.status === "QUEUED" || batch.is_draft).length;
    const totalQuantity = pendingBatches.reduce((sum, batch: any) => sum + (batch.total_quantity || 0), 0);

    const statusLabel = (status: string) => {
        const badge = STATUS_BADGE_MAP[status];
        if (!badge) return null;
        const Icon = badge.icon;
        const label = (externalQueueText?.statuses as any)?.[status] || badge.label;
        return (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                <Icon size={12} />
                {label}
            </span>
        );
    };

    if (isLoading && pendingBatches.length === 0) {
        return (
            <div className="grid gap-3">
                <div className="grid gap-2 md:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
                    ))}
                </div>
                {[1, 2, 3].map((item) => (
                    <div key={item} className="h-16 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
                ))}
            </div>
        );
    }

    if (pendingBatches.length === 0) {
        return (
            <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 text-center">
                <Inbox size={48} className="mb-4 text-[var(--color-neutral-300)]" />
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {externalQueueText?.pendingTab?.emptyTitle || "Không có yêu cầu chờ duyệt"}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {externalQueueText?.pendingTab?.emptyHint || "Các batch quét mã từ máy POS sẽ hiện ở đây."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="grid gap-2 md:grid-cols-3">
                <Metric label="Chờ duyệt" value={submittedCount.toLocaleString()} icon={ClipboardCheck} />
                <Metric label="Đang quét" value={draftCount.toLocaleString()} icon={ScanLine} />
                <Metric label="Tổng số lượng" value={totalQuantity.toLocaleString()} icon={PackageCheck} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
                <div className="flex flex-col gap-2 border-b border-[var(--color-border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder="Tìm theo mã đợt hoặc nhân viên..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchBatches(true)}
                        disabled={isRefreshing}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        Làm mới
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-[var(--color-neutral-50)]">
                            <tr>
                                <th className="border-b p-3 text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{externalQueueText?.pendingTab?.columns?.batchId || "Mã đợt"}</th>
                                <th className="border-b p-3 text-xxs font-semibold uppercase text-[var(--color-text-muted)]">Trạng thái</th>
                                <th className="border-b p-3 text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{externalQueueText?.pendingTab?.columns?.shiftDate || "Ngày ca"}</th>
                                <th className="border-b p-3 text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{externalQueueText?.pendingTab?.columns?.operator || "Nhân viên"}</th>
                                <th className="border-b p-3 text-right text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{externalQueueText?.pendingTab?.columns?.totalQty || "Tổng SL"}</th>
                                <th className="border-b p-3 text-right text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{externalQueueText?.pendingTab?.columns?.totalValue || "Tổng tiền"}</th>
                                <th className="border-b p-3 text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{externalQueueText?.pendingTab?.columns?.submittedAt || "TG gửi"}</th>
                                <th className="border-b p-3 text-right text-xxs font-semibold uppercase text-[var(--color-text-muted)]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBatches.map((batch: any) => {
                                const isDraft = batch.is_draft || batch.status === "QUEUED";
                                return (
                                    <tr key={batch.batch_id} className="border-b border-[var(--color-border-soft)] transition-colors hover:bg-[var(--color-neutral-50)]">
                                        <td className="p-3 text-sm font-semibold text-[var(--color-text-primary)]">
                                            {isDraft ? (
                                                <span className="text-[var(--color-text-muted)]">{batch.operator_name} (nháp)</span>
                                            ) : (
                                                batch.batch_id
                                            )}
                                        </td>
                                        <td className="p-3">{statusLabel(batch.status)}</td>
                                        <td className="p-3 text-sm text-[var(--color-text-secondary)]">
                                            {formatQueueDate(batch.shift_date, "dd/MM/yyyy")}
                                        </td>
                                        <td className="p-3 text-sm text-[var(--color-text-secondary)]">{batch.operator_name}</td>
                                        <td className="p-3 text-right text-sm font-bold text-[var(--color-text-primary)]">{(batch.total_quantity || 0).toLocaleString()}</td>
                                        <td className="p-3 text-right text-sm text-[var(--color-text-secondary)]">{(batch.total_value || 0).toLocaleString()}đ</td>
                                        <td className="p-3 text-sm text-[var(--color-text-muted)]">
                                            {isDraft ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock3 className="h-3.5 w-3.5" />
                                                    Chưa gửi
                                                </span>
                                            ) : (
                                                formatQueueDate(batch.submitted_at, "HH:mm dd/MM/yyyy")
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            {isDraft || !canApprove ? (
                                                <span className="text-xs text-[var(--color-text-muted)]">{isDraft ? "Đang quét" : "Chỉ xem"}</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedBatchId(batch.batch_id)}
                                                    className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)]"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    Mở
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedBatchId && (
                <BatchDetailDrawer
                    batchId={selectedBatchId}
                    batchData={pendingBatches.find((batch: any) => batch.batch_id === selectedBatchId)}
                    onClose={() => setSelectedBatchId(null)}
                    onSuccess={() => {
                        setSelectedBatchId(null);
                        fetchBatches();
                    }}
                />
            )}
        </div>
    );
}
