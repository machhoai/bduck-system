"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { format } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import {
    CalendarDays,
    ClipboardCheck,
    Clock3,
    Eye,
    Inbox,
    MapPin,
    PackageCheck,
    RefreshCw,
    ScanLine,
    Search,
    Sparkles,
    Users,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { externalQueueApi } from "../../../api/externalQueueApi";
import BatchDetailDrawer from "./BatchDetailDrawer";

const STATUS_BADGE_MAP: Record<string, { label: string; className: string; icon: ElementType }> = {
    QUEUED: {
        label: "externalQueue.statuses.QUEUED",
        className: "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
        icon: ScanLine,
    },
    SUBMITTED: {
        label: "externalQueue.statuses.SUBMITTED",
        className: "border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
        icon: ClipboardCheck,
    },
};

const safeParseDate = (val: unknown): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
    if (typeof val === "string" || typeof val === "number") {
        const date = new Date(val);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof val === "object") {
        const raw = val as { seconds?: number; _seconds?: number };
        const seconds = raw.seconds ?? raw._seconds;
        return typeof seconds === "number" ? new Date(seconds * 1000) : null;
    }
    return null;
};

function formatQueueDate(value: unknown, pattern: string) {
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
    icon: ElementType;
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
    const canManageQueue = hasPermission("external_scan.manage_queue");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchBatches = useCallback(async (showRefreshing = false) => {
        try {
            if (showRefreshing) setIsRefreshing(true);
            const result = await externalQueueApi.getPendingBatches();
            if (result?.data) setData(result.data);
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

    const handleAutoSubmit = async () => {
        if (!canManageQueue || isRefreshing) return;
        const promise = externalQueueApi.autoSubmit({ older_than_minutes: 30 });

        gooeyToast.promise(promise, {
            loading: externalQueueText?.pendingTab?.autoSubmitLoading || "Dang chay auto-submit theo quay...",
            success: externalQueueText?.pendingTab?.autoSubmitSuccess || "Da chay auto-submit",
            error: externalQueueText?.pendingTab?.autoSubmitError || "Khong the chay auto-submit",
            description: {
                success: externalQueueText?.pendingTab?.autoSubmitSuccessDesc || "Cac hang cho da qua nguong thoi gian duoc chuyen sang cho duyet.",
                error: externalQueueText?.pendingTab?.autoSubmitErrorDesc || "Vui long kiem tra quyen hoac thu lai sau.",
            },
            action: {
                error: { label: (t as any).common?.retry || "Thu lai", onClick: handleAutoSubmit },
            },
        });

        try {
            await promise;
            fetchBatches(true);
        } catch (error) {
            console.error("[ExternalQueuePendingTab] auto submit error", error);
        }
    };

    const pendingBatches = data || [];
    const filteredBatches = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) return pendingBatches;
        return pendingBatches.filter((batch: any) => {
            const operators = Array.isArray(batch.operator_names)
                ? batch.operator_names.join(" ")
                : batch.operator_name;
            return [
                batch.batch_id,
                batch.location_name,
                batch.location_code,
                batch.warehouse_name,
                batch.warehouse_code,
                operators,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        });
    }, [pendingBatches, searchTerm]);

    const submittedCount = pendingBatches.filter((batch: any) => batch.status === "SUBMITTED").length;
    const draftCount = pendingBatches.filter((batch: any) => batch.status === "QUEUED" || batch.is_draft).length;
    const totalQuantity = pendingBatches.reduce((sum, batch: any) => sum + (batch.total_quantity || 0), 0);
    const groupedByDate = useMemo(() => {
        const groups = new Map<string, any[]>();
        for (const batch of filteredBatches) {
            const key = batch.queue_date || formatQueueDate(batch.shift_date, "yyyy-MM-dd");
            const list = groups.get(key) || [];
            list.push(batch);
            groups.set(key, list);
        }
        return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
    }, [filteredBatches]);

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
                    <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
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
                    {externalQueueText?.pendingTab?.emptyHint || "Sản phẩm đang quét tại POS sẽ hiển thị tại đây."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="grid gap-2 md:grid-cols-3">
                <Metric label={externalQueueText?.pendingTab?.metrics?.submitted || "Chờ duyệt"} value={submittedCount.toLocaleString()} icon={ClipboardCheck} />
                <Metric label={externalQueueText?.pendingTab?.metrics?.draft || "Đang quét"} value={draftCount.toLocaleString()} icon={ScanLine} />
                <Metric label={externalQueueText?.pendingTab?.metrics?.totalQuantity || "Tổng số lượng"} value={totalQuantity.toLocaleString()} icon={PackageCheck} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
                <div className="flex flex-col gap-2 border-b border-[var(--color-border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder={externalQueueText?.pendingTab?.searchPlaceholder || "Tìm theo quầy, kho, mã đợt hoặc nhân viên..."}
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {canManageQueue && (
                            <button
                                type="button"
                                onClick={handleAutoSubmit}
                                disabled={isRefreshing}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                            >
                                <Sparkles className="h-4 w-4" />
                                Auto-submit
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => fetchBatches(true)}
                            disabled={isRefreshing}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            Lam moi
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-[var(--color-neutral-50)] p-3">
                    {filteredBatches.length === 0 ? (
                        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white text-sm text-[var(--color-text-muted)]">
                            Khong co hang cho phu hop tu khoa tim kiem.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedByDate.map(([dateKey, batches]) => (
                                <section key={dateKey} className="space-y-2">
                                    <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                                        <CalendarDays className="h-4 w-4" />
                                        {formatQueueDate(`${dateKey}T00:00:00`, "EEEE, dd/MM/yyyy")}
                                    </div>

                                    <div className="space-y-2">
                                        {batches.map((batch: any) => {
                                            const isDraft = batch.is_draft || batch.status === "QUEUED";
                                            const operators = Array.isArray(batch.operator_names)
                                                ? batch.operator_names.filter(Boolean)
                                                : [batch.operator_name].filter(Boolean);
                                            const canOpen = isDraft ? canManageQueue : canApprove;
                                            const timeLabel = isDraft
                                                ? formatQueueDate(batch.last_scan_time || batch.shift_date, "HH:mm")
                                                : formatQueueDate(batch.submitted_at, "HH:mm dd/MM/yyyy");

                                            return (
                                                <div
                                                    key={batch.batch_id}
                                                    className="rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 py-3 shadow-sm transition hover:border-[var(--color-border-focus)]"
                                                >
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {statusLabel(batch.status)}
                                                                <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                                                    {batch.location_name || batch.location_code || batch.warehouse_location_id}
                                                                </span>
                                                                {batch.location_code && (
                                                                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                                                                        {batch.location_code}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <MapPin className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                                    <span className="truncate">
                                                                        {batch.warehouse_name || batch.warehouse_code || batch.warehouse_id}
                                                                    </span>
                                                                </div>
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <Users className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                                    <span className="truncate">
                                                                        {operators.length > 0 ? operators.join(", ") : "-"}
                                                                    </span>
                                                                </div>
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <Clock3 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                                    <span className="truncate">
                                                                        {isDraft ? `Quet gan nhat ${timeLabel}` : `Gui luc ${timeLabel}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
                                                            <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">SKU</p>
                                                                <p className="text-sm font-bold text-[var(--color-text-primary)]">{(batch.total_products || 0).toLocaleString()}</p>
                                                            </div>
                                                            <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">SL</p>
                                                                <p className="text-sm font-bold text-[var(--color-text-primary)]">{(batch.total_quantity || 0).toLocaleString()}</p>
                                                            </div>
                                                            <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">Tien</p>
                                                                <p className="text-sm font-bold text-[var(--color-brand-primary)]">{(batch.total_value || 0).toLocaleString()}d</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-end lg:w-28">
                                                            {canOpen ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedBatchId(batch.batch_id)}
                                                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)]"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    Mo
                                                                </button>
                                                            ) : (
                                                                <span className="inline-flex h-9 items-center text-xs text-[var(--color-text-muted)]">
                                                                    {isDraft ? "Dang quet" : "Chi xem"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
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
