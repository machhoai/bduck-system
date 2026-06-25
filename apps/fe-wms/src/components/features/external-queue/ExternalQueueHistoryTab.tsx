"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, type Locale } from "date-fns";
import { vi, zhCN } from "date-fns/locale";
import {
    CalendarDays,
    CalendarRange,
    CheckCircle,
    Eye,
    FilterX,
    History,
    MapPin,
    PackageCheck,
    Search,
    Store,
    User,
    XCircle,
} from "lucide-react";
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { useTranslation } from "../../../lib/i18n";
import { externalQueueApi } from "../../../api/externalQueueApi";
import { formatExportDate } from "../../../utils/exportExcel";
import BatchDetailDrawer from "./BatchDetailDrawer";

function safeDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "object") {
        const raw = value as { seconds?: number; _seconds?: number };
        const seconds = raw.seconds ?? raw._seconds;
        return typeof seconds === "number" ? new Date(seconds * 1000) : null;
    }
    return null;
}

function formatDate(value: unknown, pattern: string, locale: Locale) {
    const date = safeDate(value);
    return date ? format(date, pattern, { locale }) : "-";
}

function formatDateInput(value: unknown) {
    const date = safeDate(value);
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
}

function getBatchProcessedDate(batch: any) {
    return (
        batch.processed_at ||
        batch.approved_at ||
        batch.submitted_at ||
        batch.last_scan_time ||
        batch.shift_date
    );
}

function getLocationFilterValue(batch: any) {
    return (
        batch.warehouse_location_id ||
        batch.location_code ||
        batch.location_name ||
        ""
    );
}

function getLocationLabel(batch: any) {
    return [
        batch.location_name || batch.location_code || batch.warehouse_location_id,
        batch.warehouse_name || batch.warehouse_code,
    ]
        .filter(Boolean)
        .join(" - ");
}

function getStatusText(status: string, statusText: Record<string, string>) {
    return statusText?.[status] || status || "";
}

function buildExternalQueueExportRows(batches: any[]) {
    return batches.flatMap((batch) => {
        const items =
            Array.isArray(batch.items) && batch.items.length > 0
                ? batch.items
                : [null];
        const operators = Array.isArray(batch.operator_names)
            ? batch.operator_names.filter(Boolean).join(", ")
            : batch.operator_name || "";

        return items.map((item: any) => ({
            batch_id: batch.batch_id,
            status: batch.status,
            warehouse_id: batch.warehouse_id,
            warehouse_name: batch.warehouse_name,
            warehouse_code: batch.warehouse_code,
            warehouse_location_id: batch.warehouse_location_id,
            location_name: batch.location_name,
            location_code: batch.location_code,
            operator_names: operators,
            total_products: batch.total_products,
            total_quantity: batch.total_quantity,
            total_value: batch.total_value,
            queue_date: batch.queue_date,
            shift_date: batch.shift_date,
            submitted_at: batch.submitted_at,
            last_scan_time: batch.last_scan_time,
            processed_at: batch.processed_at,
            approved_at: batch.approved_at,
            approved_by: batch.approved_by,
            approved_by_name: batch.approved_by_name || batch.processed_by_name,
            export_voucher_id: batch.export_voucher_id,
            rejection_reason: batch.rejection_reason,
            batch_notes: batch.notes,
            scan_id: item?.scan_id || "",
            product_id: item?.product_id || "",
            product_name: item?.product_name || "",
            product_code: item?.product_code || "",
            product_barcode: item?.product_barcode || "",
            barcode: item?.barcode || "",
            product_unit: item?.product_unit || "",
            quantity: item?.quantity ?? "",
            unit_price: item?.unit_price ?? "",
            line_total:
                item?.unit_price != null && item?.quantity != null
                    ? item.quantity * item.unit_price
                    : "",
            scan_time: item?.scan_time || "",
            item_operator_name: item?.operator_name || "",
            operator_id_external: item?.operator_id_external || "",
            item_warehouse_id: item?.warehouse_id || "",
            item_warehouse_name: item?.warehouse_name || "",
            item_warehouse_code: item?.warehouse_code || "",
            item_location_id: item?.warehouse_location_id || "",
            item_location_name: item?.location_name || "",
            item_location_code: item?.location_code || "",
            item_notes: item?.notes || "",
            item_rejection_reason: item?.rejection_reason || "",
        }));
    });
}

export default function ExternalQueueHistoryTab() {
    const { t, lang } = useTranslation();
    const externalQueueText = (t as any).externalQueue;
    const historyText = externalQueueText.historyTab;
    const dateLocale = lang === "zh" ? zhCN : vi;
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

    const fetchHistory = useCallback(async () => {
        try {
            const result = await externalQueueApi.getHistory();
            if (result?.data) setData(result.data);
        } catch (error) {
            console.error("[ExternalQueueHistoryTab] fetch failed", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const historyBatches = data || [];
    const locationOptions = useMemo(() => {
        const options = new Map<string, string>();
        for (const batch of historyBatches) {
            const value = getLocationFilterValue(batch);
            if (!value) continue;
            options.set(value, getLocationLabel(batch) || value);
        }
        return Array.from(options.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [historyBatches]);

    const filteredBatches = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return historyBatches.filter((batch: any) => {
            const batchDate = formatDateInput(getBatchProcessedDate(batch));
            return (
                (!normalizedSearch ||
                    [
                        batch.batch_id,
                        batch.operator_name,
                        batch.operator_names?.join(" "),
                        batch.location_name,
                        batch.location_code,
                        batch.warehouse_name,
                        batch.warehouse_code,
                        batch.status,
                        batch.approved_by_name,
                        batch.processed_by_name,
                        batch.rejection_reason,
                        batch.export_voucher_id,
                    ]
                        .filter(Boolean)
                        .some((value) =>
                            String(value).toLowerCase().includes(normalizedSearch),
                        )) &&
                (!locationFilter || getLocationFilterValue(batch) === locationFilter) &&
                (!dateFrom || (batchDate && batchDate >= dateFrom)) &&
                (!dateTo || (batchDate && batchDate <= dateTo))
            );
        });
    }, [dateFrom, dateTo, historyBatches, locationFilter, searchTerm]);

    const hasActiveFilters = Boolean(
        searchTerm.trim() || dateFrom || dateTo || locationFilter,
    );

    const groupedByDate = useMemo(() => {
        const groups = new Map<string, any[]>();
        for (const batch of filteredBatches) {
            const key = formatDate(
                batch.shift_date || batch.approved_at || batch.processed_at,
                "yyyy-MM-dd",
                dateLocale,
            );
            const list = groups.get(key) || [];
            list.push(batch);
            groups.set(key, list);
        }
        return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
    }, [dateLocale, filteredBatches]);

    const exportConfig = useMemo(() => {
        if (!filteredBatches.length) return null;
        const statusText = (externalQueueText.statuses || {}) as Record<
            string,
            string
        >;
        return {
            filename: "external_queue_batches",
            entityType: "external_queue",
            filters: {
                search: searchTerm,
                date_from: dateFrom,
                date_to: dateTo,
                warehouse_location: locationFilter,
            },
            data: buildExternalQueueExportRows(filteredBatches),
            columns: [
                { header: "Batch ID", key: "batch_id", width: 28 },
                {
                    header: "Trạng thái",
                    key: "status",
                    width: 18,
                    format: (value: string) => getStatusText(value, statusText),
                },
                { header: "Kho", key: "warehouse_name", width: 24 },
                { header: "Mã kho", key: "warehouse_code", width: 16 },
                { header: "Quầy/Vị trí", key: "location_name", width: 24 },
                { header: "Mã quầy", key: "location_code", width: 16 },
                { header: "Nhân viên quét", key: "operator_names", width: 28 },
                { header: "Số SKU batch", key: "total_products", width: 14 },
                { header: "Tổng SL batch", key: "total_quantity", width: 14 },
                { header: "Tổng tiền batch", key: "total_value", width: 18 },
                { header: "Ngày queue", key: "queue_date", width: 14 },
                {
                    header: "Thời gian quét",
                    key: "scan_time",
                    width: 22,
                    format: formatExportDate,
                },
                {
                    header: "Lần quét cuối",
                    key: "last_scan_time",
                    width: 22,
                    format: formatExportDate,
                },
                {
                    header: "Thời gian gửi",
                    key: "submitted_at",
                    width: 22,
                    format: formatExportDate,
                },
                {
                    header: "Thời gian xử lý",
                    key: "processed_at",
                    width: 22,
                    format: formatExportDate,
                },
                {
                    header: "Thời gian duyệt",
                    key: "approved_at",
                    width: 22,
                    format: formatExportDate,
                },
                { header: "Người duyệt", key: "approved_by_name", width: 24 },
                { header: "Phiếu xuất", key: "export_voucher_id", width: 28 },
                { header: "Lý do từ chối batch", key: "rejection_reason", width: 32 },
                { header: "Ghi chú batch", key: "batch_notes", width: 32 },
                { header: "Tên sản phẩm", key: "product_name", width: 30 },
                { header: "Mã sản phẩm", key: "product_code", width: 18 },
                { header: "Barcode sản phẩm", key: "product_barcode", width: 20 },
                { header: "Barcode quét", key: "barcode", width: 20 },
                { header: "Đơn vị", key: "product_unit", width: 12 },
                { header: "SL / dòng", key: "quantity", width: 12 },
                { header: "Đơn giá", key: "unit_price", width: 14 },
                { header: "Thành tiền", key: "line_total", width: 16 },
                { header: "Ghi chú dòng", key: "item_notes", width: 32 },
                {
                    header: "Lý do từ chối dòng",
                    key: "item_rejection_reason",
                    width: 32,
                },
            ],
        };
    }, [
        dateFrom,
        dateTo,
        externalQueueText.statuses,
        filteredBatches,
        locationFilter,
        searchTerm,
    ]);

    useExportRegistration(exportConfig);

    if (isLoading && historyBatches.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                {[1, 2, 3].map((item) => (
                    <div
                        key={item}
                        className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]"
                    />
                ))}
            </div>
        );
    }

    if (historyBatches.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white">
                <History size={48} className="mb-4 text-[var(--color-neutral-300)]" />
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {historyText.emptyTitle}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {historyText.emptyHint}
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
            <div className="border-b border-[var(--color-border-subtle)] p-3">
                <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px_220px_auto]">
                    <div className="relative min-w-0">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                        />
                        <input
                            type="text"
                            placeholder={historyText.searchPlaceholder}
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                        />
                    </div>

                    <label className="relative min-w-0">
                        <CalendarRange
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                        />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(event) => setDateFrom(event.target.value)}
                            aria-label="Từ ngày xử lý"
                            title="Từ ngày xử lý"
                            className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                        />
                    </label>

                    <label className="relative min-w-0">
                        <CalendarDays
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(event) => setDateTo(event.target.value)}
                            aria-label="Đến ngày xử lý"
                            title="Đến ngày xử lý"
                            className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                        />
                    </label>

                    <label className="relative min-w-0">
                        <Store
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                        />
                        <select
                            value={locationFilter}
                            onChange={(event) => setLocationFilter(event.target.value)}
                            aria-label="Lọc theo quầy"
                            title="Lọc theo quầy"
                            className="h-9 w-full appearance-none rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-8 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                        >
                            <option value="">Tất cả quầy</option>
                            {locationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm("");
                            setDateFrom("");
                            setDateTo("");
                            setLocationFilter("");
                        }}
                        disabled={!hasActiveFilters}
                        title="Xóa bộ lọc"
                        aria-label="Xóa bộ lọc"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <FilterX className="h-4 w-4" />
                        <span className="lg:hidden">Xóa lọc</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-[var(--color-neutral-50)] p-3">
                {filteredBatches.length === 0 ? (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white text-sm text-[var(--color-text-muted)]">
                        {historyText.noResults}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedByDate.map(([dateKey, batches]) => (
                            <section key={dateKey} className="space-y-2">
                                <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                                    <CalendarDays className="h-4 w-4" />
                                    {formatDate(
                                        `${dateKey}T00:00:00`,
                                        "EEEE, dd/MM/yyyy",
                                        dateLocale,
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {batches.map((batch: any) => {
                                        const isApproved =
                                            batch.status === "APPROVED" ||
                                            batch.status === "EXPORTED";
                                        const StatusIcon = isApproved ? CheckCircle : XCircle;
                                        const processedAt = batch.processed_at || batch.approved_at;

                                        return (
                                            <div
                                                key={batch.batch_id}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`${historyText.openDetail} ${batch.batch_id}`}
                                                onClick={() => setSelectedBatch(batch)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        setSelectedBatch(batch);
                                                    }
                                                }}
                                                className="rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                                            >
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${isApproved
                                                                    ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                                                    : "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                                                                    }`}
                                                            >
                                                                <StatusIcon className="h-3 w-3" />
                                                                {isApproved
                                                                    ? historyText.processed
                                                                    : historyText.rejected}
                                                            </span>
                                                            <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                                                {batch.location_name || batch.batch_id}
                                                            </span>
                                                            {batch.location_code && (
                                                                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                                                                    {batch.location_code}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <User className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                                <span className="truncate">
                                                                    {batch.operator_name ||
                                                                        historyText.unknownOperator}
                                                                </span>
                                                            </div>
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <MapPin className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                                <span className="truncate">
                                                                    {batch.warehouse_name ||
                                                                        batch.warehouse_code ||
                                                                        batch.warehouse_id ||
                                                                        "-"}
                                                                </span>
                                                            </div>
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <PackageCheck className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                                <span>
                                                                    {(batch.total_quantity || 0).toLocaleString()}{" "}
                                                                    {historyText.products}
                                                                </span>
                                                            </div>
                                                            <div className="truncate text-[var(--color-text-muted)]">
                                                                {historyText.processedAt}
                                                                {formatDate(
                                                                    processedAt,
                                                                    "HH:mm dd/MM/yyyy",
                                                                    dateLocale,
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                            {historyText.batch}
                                                        </p>
                                                        <p className="max-w-[240px] truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                                            {batch.batch_id}
                                                        </p>
                                                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                                            {batch.processed_by_name ||
                                                                batch.approved_by_name ||
                                                                historyText.unknownOperator}
                                                        </p>
                                                        <div className="mt-2 inline-flex items-center justify-end gap-1 text-xs font-semibold text-[var(--color-brand-primary)]">
                                                            <Eye className="h-3.5 w-3.5" />
                                                            {historyText.openDetail}
                                                        </div>
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
            {selectedBatch && (
                <BatchDetailDrawer
                    batchId={selectedBatch.batch_id}
                    batchData={selectedBatch}
                    readonly
                    onClose={() => setSelectedBatch(null)}
                />
            )}
        </div>
    );
}
