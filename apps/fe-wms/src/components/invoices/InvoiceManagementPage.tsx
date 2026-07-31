"use client";

import { InvoiceDocumentStatus, InvoiceOrderSyncPurpose, InvoicePreparationStatus } from "@bduck/shared-types";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    FileWarning,
    LoaderCircle,
    RefreshCw,
    ReceiptText,
    Search,
    ShieldCheck,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { invoiceApi, type InvoiceSourceOrderView, type InvoiceSyncResult } from "@/api/invoiceApi";
import { useStores } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { shortName } from "@/utils/name";
import { showToast } from "@/utils/toast";

import { BottomSheet } from "../ui/BottomSheet";

import { InvoiceBulkIssuePanel } from "./bulk-issue/InvoiceBulkIssuePanel";
import { InvoiceConfigurationPanel } from "./InvoiceConfigurationPanel";
import { InvoiceDraftWorkflow } from "./InvoiceDraftWorkflow";
import { InvoiceLedgerPanel } from "./InvoiceLedgerPanel";
import { MisaInvoicePanel } from "./MisaInvoicePanel";

const copy = {
    vi: {
        eyebrow: "MISA meInvoice",
        title: "Quản lý hóa đơn",
        subtitle: "Đồng bộ toàn bộ đơn trong ngày, kiểm tra số liệu và xem trước trước khi phát hành.",
        store: "Cửa hàng",
        date: "Ngày giao dịch",
        purpose: "Mục đích đồng bộ",
        issue: "Chuẩn bị phát hành",
        reconciliation: "Đối chiếu",
        sync: "Đồng bộ toàn ngày",
        syncing: "Đang đồng bộ…",
        total: "Tổng đơn",
        ready: "Sẵn sàng phát hành",
        tax: "Thiếu cấu hình thuế",
        review: "Cần xử lý",
        search: "Tìm mã đơn hoặc khách hàng",
        all: "Tất cả trạng thái",
        empty: "Chưa có dữ liệu đơn hàng cho ngày này.",
        emptyHint: "Chọn Đồng bộ toàn ngày để tải đầy đủ đơn hàng từ HKAPI.",
        order: "Đơn hàng",
        payment: "Thanh toán",
        beforeTax: "Trước thuế",
        vat: "VAT",
        totalMoney: "Tổng tiền",
        status: "Preflight",
        detail: "Chi tiết kiểm tra",
        sourceItems: "Dòng hàng hóa",
        issues: "Điểm cần xử lý",
        noIssues: "Không có lỗi preflight.",
        preview: "Xem trước hóa đơn",
        previewing: "Đang tạo link…",
        previewExpires: "Link MISA có hiệu lực 5 phút.",
        close: "Đóng",
        loading: "Đang tải dữ liệu…",
        noStore: "Bạn chưa có cửa hàng phù hợp trong phạm vi quyền.",
        syncDone: "Đồng bộ hoàn tất",
        inserted: "Mới",
        updated: "Thay đổi",
        unchanged: "Không đổi",
        retry: "Thử lại",
        syncFailed: "Đồng bộ hóa đơn thất bại",
        syncDescription: "Toàn bộ đơn hàng trong ngày đã được lưu và tính lại preflight.",
        previewReady: "Đã tạo bản xem trước",
        previewFailed: "Không thể xem trước hóa đơn",
        matchedMisa: "Khớp MISA",
        misaReturned: "MISA trả về",
        notIssued: "Chưa xuất",
        mismatches: "Sai lệch",
        unlinked: "Chưa có mã liên kết",
        syncSummaryTitle: "Kết quả đồng bộ",
        syncDetailsTitle: "Đối chiếu MISA",
        errorTitle: "Lỗi tải dữ liệu",
        dismiss: "Ẩn",
    },
    zh: {
        eyebrow: "MISA meInvoice",
        title: "发票管理",
        subtitle: "同步当天全部订单，核对金额并在开票前预览。",
        store: "门店",
        date: "交易日期",
        purpose: "同步用途",
        issue: "准备开票",
        reconciliation: "对账",
        sync: "同步全天订单",
        syncing: "同步中…",
        total: "订单总数",
        ready: "可开票",
        tax: "缺少税务配置",
        review: "需要处理",
        search: "搜索订单号或客户",
        all: "全部状态",
        empty: "当天尚无订单数据。",
        emptyHint: "请选择同步全天订单，从 HKAPI 获取完整数据。",
        order: "订单",
        payment: "付款",
        beforeTax: "税前金额",
        vat: "增值税",
        totalMoney: "总金额",
        status: "预检",
        detail: "检查详情",
        sourceItems: "商品明细",
        issues: "待处理项",
        noIssues: "没有预检错误。",
        preview: "预览发票",
        previewing: "正在生成链接…",
        previewExpires: "MISA 预览链接有效期为 5 分钟。",
        close: "关闭",
        loading: "正在加载…",
        noStore: "您的权限范围内没有可用门店。",
        syncDone: "同步完成",
        inserted: "新增",
        updated: "更新",
        unchanged: "未变化",
        retry: "重试",
        syncFailed: "发票同步失败",
        syncDescription: "当天全部订单已保存并重新执行预检。",
        previewReady: "预览已生成",
        previewFailed: "无法预览发票",
        matchedMisa: "MISA 匹配",
        misaReturned: "MISA 返回",
        notIssued: "未开票",
        mismatches: "差异/不匹配",
        unlinked: "未关联代码",
        syncSummaryTitle: "同步结果",
        syncDetailsTitle: "MISA 对账",
        errorTitle: "加载数据错误",
        dismiss: "隐藏",
    },
} as const;

const todayInVietnam = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());

const initialQueryValue = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) ?? fallback;
};

const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
});

const statusStyle = (status: InvoicePreparationStatus) => {
    if (status === InvoicePreparationStatus.READY_TO_ISSUE || status === InvoicePreparationStatus.READY_FOR_REVIEW) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION) {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-rose-200 bg-rose-50 text-rose-700";
};

const statusLabel = (status: InvoicePreparationStatus, lang: "vi" | "zh") => {
    const values = {
        vi: {
            [InvoicePreparationStatus.READY_FOR_REVIEW]: "Sẵn sàng để xem",
            [InvoicePreparationStatus.READY_TO_ISSUE]: "Sẵn sàng phát hành",
            [InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION]: "Thiếu cấu hình thuế",
            [InvoicePreparationStatus.NEEDS_REVIEW]: "Cần xem lại",
            [InvoicePreparationStatus.NEEDS_CORRECTION]: "Cần chỉnh dữ liệu",
        },
        zh: {
            [InvoicePreparationStatus.READY_FOR_REVIEW]: "可开票",
            [InvoicePreparationStatus.READY_TO_ISSUE]: "可开票",
            [InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION]: "缺少税务配置",
            [InvoicePreparationStatus.NEEDS_REVIEW]: "需要处理",
            [InvoicePreparationStatus.NEEDS_CORRECTION]: "需要修正数据",
        },
    };
    return values[lang][status] ?? status;
};

const documentStatusLabel = (status: InvoiceDocumentStatus, lang: "vi" | "zh") => {
    const values: Record<"vi" | "zh", Partial<Record<InvoiceDocumentStatus, string>>> = {
        vi: {
            NEEDS_TAX_CONFIGURATION: "Draft thiếu cấu hình thuế",
            NEEDS_CORRECTION: "Draft cần chỉnh dữ liệu",
            NEEDS_REVIEW: "Draft cũ — sẵn sàng phát hành",
            NEEDS_SECOND_REVIEW: "Draft cũ — sẵn sàng phát hành",
            READY_TO_ISSUE: "Draft sẵn sàng phát hành",
            REJECTED: "Draft đã từ chối",
            RETRYABLE_ERROR: "MISA đang được thử lại",
            MANUAL_RECONCILIATION: "Tạm dừng để kiểm tra an toàn",
        },
        zh: {
            NEEDS_TAX_CONFIGURATION: "草稿缺少税务配置",
            NEEDS_CORRECTION: "草稿需要修正数据",
            NEEDS_REVIEW: "旧草稿 — 可开票",
            NEEDS_SECOND_REVIEW: "旧草稿 — 可开票",
            READY_TO_ISSUE: "草稿可开票",
            REJECTED: "草稿已拒绝",
            RETRYABLE_ERROR: "正在重试 MISA",
            MANUAL_RECONCILIATION: "已暂停以安全检查",
        },
    };
    return values[lang][status] ?? status;
};

const canSelectForBulkIssue = (order: InvoiceSourceOrderView) =>
    order.preflight.issue_eligible === true &&
    Boolean(order.invoice_document_id) &&
    [
        InvoiceDocumentStatus.NEEDS_REVIEW,
        InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
        InvoiceDocumentStatus.READY_TO_ISSUE,
    ].includes(order.invoice_document_status as InvoiceDocumentStatus);

type InvoiceView = "PENDING" | "ISSUED" | "RECONCILIATION" | "MISA" | "CONFIG";

export default function InvoiceManagementPage() {
    const { lang } = useTranslation();
    const d = copy[lang];
    const { stores, loading: storesLoading } = useStores();
    const hasPermission = useUserStore((state) => state.hasPermission);
    const [view, setView] = useState<InvoiceView>(() => {
        const value = initialQueryValue("tab");
        return value === "ISSUED" || value === "RECONCILIATION" || value === "MISA" || value === "CONFIG"
            ? value
            : "PENDING";
    });
    const [selectedStoreId, setSelectedStoreId] = useState(() => initialQueryValue("store"));
    const activeStoreId = stores.some((store) => store.id === selectedStoreId)
        ? selectedStoreId
        : (stores[0]?.id ?? "");
    const [businessDate, setBusinessDate] = useState(() => initialQueryValue("date", todayInVietnam()));
    const [purpose, setPurpose] = useState<InvoiceOrderSyncPurpose>(() =>
        initialQueryValue("purpose") === InvoiceOrderSyncPurpose.RECONCILIATION
            ? InvoiceOrderSyncPurpose.RECONCILIATION
            : InvoiceOrderSyncPurpose.ISSUE,
    );
    const [orders, setOrders] = useState<InvoiceSourceOrderView[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<InvoiceSourceOrderView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<InvoiceSyncResult | null>(null);
    const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
    const [query, setQuery] = useState(() => initialQueryValue("q"));
    const [statusFilter, setStatusFilter] = useState<"ALL" | InvoicePreparationStatus>(() => {
        const value = initialQueryValue("status");
        return Object.values(InvoicePreparationStatus).includes(value as InvoicePreparationStatus)
            ? (value as InvoicePreparationStatus)
            : "ALL";
    });
    const loadGeneration = useRef(0);

    const loadOrders = useCallback(async () => {
        const generation = ++loadGeneration.current;
        if (view === "CONFIG" || !activeStoreId || !businessDate) {
            setOrders([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const nextOrders = await invoiceApi.listSourceOrders(activeStoreId, businessDate);
            if (generation === loadGeneration.current) setOrders(nextOrders);
        } catch (loadError) {
            if (generation !== loadGeneration.current) return;
            setOrders([]);
            setError(loadError instanceof Error ? loadError.message : "Unable to load invoices.");
        } finally {
            if (generation === loadGeneration.current) setLoading(false);
        }
    }, [activeStoreId, businessDate, view]);

    useEffect(() => {
        void loadOrders();
        return () => {
            loadGeneration.current += 1;
        };
    }, [loadOrders]);

    useEffect(() => {
        setSelectedIssueIds([]);
    }, [activeStoreId, businessDate]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const setOrDelete = (key: string, value: string, defaultValue = "") => {
            if (!value || value === defaultValue) params.delete(key);
            else params.set(key, value);
        };
        setOrDelete("store", activeStoreId);
        setOrDelete("date", businessDate, todayInVietnam());
        setOrDelete("purpose", purpose, InvoiceOrderSyncPurpose.ISSUE);
        setOrDelete("status", statusFilter, "ALL");
        setOrDelete("q", query.trim());
        setOrDelete("tab", view, "PENDING");
        const next = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }, [activeStoreId, businessDate, purpose, query, statusFilter, view]);

    const handleSync = async () => {
        if (!activeStoreId) return;
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            const operation = invoiceApi.syncSourceOrders(activeStoreId, businessDate, purpose).then(async (result) => {
                setSyncResult(result);
                await loadOrders();
                return result;
            });
            await showToast.promise(operation, {
                loading: d.syncing,
                success: d.syncDone,
                error: d.syncFailed,
                successDescription: d.syncDescription,
                errorDescription: (toastError) => (toastError instanceof Error ? toastError.message : d.syncFailed),
            });
        } catch (syncError) {
            setError(syncError instanceof Error ? syncError.message : "Unable to sync invoices.");
        } finally {
            setSyncing(false);
        }
    };

    const stats = useMemo(
        () => ({
            total: orders.length,
            ready: orders.filter((order) =>
                [InvoicePreparationStatus.READY_TO_ISSUE, InvoicePreparationStatus.READY_FOR_REVIEW].includes(
                    order.preflight.status,
                ),
            ).length,
            tax: orders.filter((order) => order.preflight.status === InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION)
                .length,
            review: orders.filter((order) =>
                [InvoicePreparationStatus.NEEDS_CORRECTION, InvoicePreparationStatus.NEEDS_REVIEW].includes(
                    order.preflight.status,
                ),
            ).length,
        }),
        [orders],
    );

    const filteredOrders = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase(lang);
        return orders.filter((order) => {
            if (statusFilter !== "ALL" && order.preflight.status !== statusFilter) return false;
            if (!normalizedQuery) return true;
            return [order.order_number, order.source_order_id, order.customer_name]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase(lang).includes(normalizedQuery));
        });
    }, [lang, orders, query, statusFilter]);

    const canSync =
        purpose === InvoiceOrderSyncPurpose.ISSUE
            ? hasPermission("invoices.prepare", activeStoreId)
            : hasPermission("invoices.reconcile", activeStoreId);
    const canBulkIssue = hasPermission("invoices.bulk_issue", activeStoreId);
    const canRetryIssue = hasPermission("invoices.retry", activeStoreId);
    const canConfigure = hasPermission("invoices.config", activeStoreId);
    const invoiceViews: Array<[InvoiceView, string]> = [
        ["PENDING", lang === "vi" ? "Chờ phát hành" : "Pending"],
        ["ISSUED", lang === "vi" ? "Đã phát hành" : "Issued"],
        ["RECONCILIATION", lang === "vi" ? "Lỗi / Đối chiếu" : "Reconciliation"],
        ["MISA", lang === "vi" ? "Toàn bộ hóa đơn MISA" : "All MISA invoices"],
        ...(canConfigure
            ? ([["CONFIG", lang === "vi" ? "Cấu hình" : "Configuration"]] as Array<[InvoiceView, string]>)
            : []),
    ];
    const selectableIssueIds = filteredOrders.filter(canSelectForBulkIssue).map((order) => order.id);
    const selectedEligibleIds = selectedIssueIds.filter((id) =>
        orders.some((order) => order.id === id && canSelectForBulkIssue(order)),
    );
    const dailyEligibleCount = orders.filter(canSelectForBulkIssue).length;

    const toggleIssueId = (id: string) => {
        setSelectedIssueIds((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        );
    };

    if (!storesLoading && stores.length === 0) {
        return (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-6 text-center">
                <ReceiptText className="mb-3 text-[var(--color-text-muted)]" size={40} />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{d.noStore}</p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-3 pb-4">
            <header className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="border-b border-[var(--color-border-subtle)] bg-[linear-gradient(120deg,#0f172a,#163a5f)] px-3 py-4 text-white sm:px-4">
                    <p className="text-xxs font-semibold uppercase tracking-[0.18em] text-sky-200">{d.eyebrow}</p>
                    <h1 className="mt-0.5 text-lg font-bold">{d.title}</h1>
                    <p className="mt-0.5 max-w-[60%] text-xs text-slate-300">{d.subtitle}</p>
                </div>
                <div
                    className={`grid gap-2 p-2.5 ${view === "CONFIG" ? "sm:grid-cols-[minmax(220px,420px)]" : "sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_minmax(260px,1fr)_auto] lg:items-end"}`}
                >
                    <Field label={d.store}>
                        <select
                            value={activeStoreId}
                            onChange={(event) => setSelectedStoreId(event.target.value)}
                            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2.5 text-xs font-semibold outline-none focus:border-[var(--color-brand-primary)]"
                        >
                            {stores.map((store) => (
                                <option key={store.id} value={store.id}>
                                    {store.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {view !== "CONFIG" && (
                        <Field label={d.date}>
                            <input
                                type="date"
                                value={businessDate}
                                onChange={(event) => setBusinessDate(event.target.value)}
                                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2.5 text-xs font-semibold outline-none focus:border-[var(--color-brand-primary)]"
                            />
                        </Field>
                    )}
                    {view !== "CONFIG" && (
                        <Field label={d.purpose}>
                            <div className="grid grid-cols-2 rounded-[var(--radius-md)] bg-slate-100 p-1">
                                {[
                                    [InvoiceOrderSyncPurpose.ISSUE, d.issue],
                                    [InvoiceOrderSyncPurpose.RECONCILIATION, d.reconciliation],
                                ].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setPurpose(value as InvoiceOrderSyncPurpose)}
                                        className={`h-8 rounded-sm px-2 text-xs font-semibold transition ${purpose === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </Field>
                    )}
                    {view !== "CONFIG" && (
                        <button
                            type="button"
                            onClick={handleSync}
                            disabled={!canSync || syncing || !activeStoreId}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {syncing ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                            {syncing ? d.syncing : d.sync}
                        </button>
                    )}
                </div>
            </header>

            <nav
                className="grid grid-cols-2 gap-1.5 p-1.5 sm:flex sm:flex-wrap sm:items-center rounded-3xl md:rounded-full border border-[var(--color-border-subtle)] bg-white shadow-2xs"
                aria-label="Invoice views"
            >
                {invoiceViews.map(([value, label], index) => {
                    const isLastOdd = index === invoiceViews.length - 1 && invoiceViews.length % 2 !== 0;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setView(value);
                                if (value === "RECONCILIATION" || value === "MISA")
                                    setPurpose(InvoiceOrderSyncPurpose.RECONCILIATION);
                            }}
                            className={`flex items-center justify-center rounded-full px-3 py-2 text-center text-xs font-semibold transition ${isLastOdd ? "col-span-2 sm:col-span-1" : ""
                                } ${view === value
                                    ? "bg-slate-900 text-white shadow-2xs"
                                    : "bg-slate-50/80 text-slate-600 hover:bg-slate-100 sm:bg-transparent"
                                }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </nav>

            {view !== "CONFIG" && error && (
                <ErrorNotificationCard
                    d={d}
                    error={error}
                    loading={loading}
                    onDismiss={() => setError(null)}
                    onRetry={() => void loadOrders()}
                />
            )}
            {view !== "CONFIG" && syncResult && (
                <SyncResultCard d={d} onDismiss={() => setSyncResult(null)} syncResult={syncResult} />
            )}

            {view === "CONFIG" ? (
                <InvoiceConfigurationPanel warehouseId={activeStoreId} canConfigure={canConfigure} lang={lang} />
            ) : view === "PENDING" ? (
                <>
                    {(canBulkIssue || canRetryIssue) && (
                        <InvoiceBulkIssuePanel
                            warehouseId={activeStoreId}
                            businessDate={businessDate}
                            selectedIds={selectedEligibleIds}
                            eligibleCount={dailyEligibleCount}
                            canIssue={canBulkIssue}
                            canRetry={canRetryIssue}
                            lang={lang}
                            onIssued={() => setSelectedIssueIds([])}
                            onCompleted={() => void loadOrders()}
                        />
                    )}

                    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <StatCard label={d.total} value={stats.total} icon={<ReceiptText size={15} />} />
                        <StatCard label={d.ready} value={stats.ready} icon={<ShieldCheck size={15} />} tone="success" />
                        <StatCard label={d.tax} value={stats.tax} icon={<FileWarning size={15} />} tone="warning" />
                        <StatCard
                            label={d.review}
                            value={stats.review}
                            icon={<AlertTriangle size={15} />}
                            tone="danger"
                        />
                    </section>

                    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                        <div className="flex flex-col gap-2 border-b border-[var(--color-border-subtle)] p-2.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative flex-1 sm:max-w-[60%]">
                                <Search
                                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                                    size={13}
                                />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={d.search}
                                    className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white pl-8 pr-2.5 text-xs outline-none focus:border-[var(--color-brand-primary)]"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                                className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2.5 text-xs font-semibold outline-none"
                            >
                                <option value="ALL">{d.all}</option>
                                {Object.values(InvoicePreparationStatus).map((status) => (
                                    <option key={status} value={status}>
                                        {statusLabel(status, lang)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {loading ? (
                            <div className="p-3 space-y-2 animate-pulse" aria-label={d.loading}>
                                {[...Array(4)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex h-12 items-center gap-4 rounded-xl bg-slate-100/70 px-4 border border-slate-200/50"
                                    >
                                        <div className="h-4 w-32 rounded bg-slate-200" />
                                        <div className="h-4 w-24 rounded bg-slate-200" />
                                        <div className="h-4 w-16 rounded bg-slate-200" />
                                        <div className="ml-auto h-6 w-20 rounded-full bg-slate-200" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                                <ReceiptText size={30} className="mb-2.5 text-slate-300" />
                                <p className="text-xs font-semibold text-[var(--color-text-primary)]">{d.empty}</p>
                                <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">{d.emptyHint}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5 p-3">
                                {canBulkIssue && (
                                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    selectableIssueIds.length > 0 &&
                                                    selectableIssueIds.every((id) => selectedIssueIds.includes(id))
                                                }
                                                onChange={() => {
                                                    setSelectedIssueIds(
                                                        selectableIssueIds.every((id) => selectedIssueIds.includes(id))
                                                            ? []
                                                            : selectableIssueIds,
                                                    );
                                                }}
                                                disabled={selectableIssueIds.length === 0}
                                                aria-label={
                                                    lang === "vi"
                                                        ? "Chọn tất cả hóa đơn sẵn sàng"
                                                        : "Select all ready invoices"
                                                }
                                                className="h-4 w-4 rounded accent-sky-700 cursor-pointer"
                                            />
                                            <span>
                                                {lang === "vi"
                                                    ? "Chọn tất cả hóa đơn sẵn sàng phát hành"
                                                    : "Select all ready invoices"}
                                            </span>
                                        </div>
                                        <span className="text-slate-500 font-medium">
                                            {selectedIssueIds.length} / {selectableIssueIds.length}{" "}
                                            {lang === "vi" ? "đã chọn" : "selected"}
                                        </span>
                                    </div>
                                )}

                                {filteredOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={`group relative rounded-xl border transition-all duration-150 bg-white p-3.5 shadow-2xs hover:shadow-md ${selectedIssueIds.includes(order.id)
                                                ? "border-sky-400 bg-sky-50/20 ring-1 ring-sky-300"
                                                : "border-slate-200/90 hover:border-sky-300"
                                            }`}
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                {canBulkIssue && canSelectForBulkIssue(order) && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIssueIds.includes(order.id)}
                                                        onChange={() => toggleIssueId(order.id)}
                                                        aria-label={
                                                            lang === "vi"
                                                                ? "Chọn hóa đơn để phát hành"
                                                                : "Select invoice to issue"
                                                        }
                                                        className="mt-1 h-4 w-4 shrink-0 rounded accent-sky-700 cursor-pointer"
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="min-w-0 flex-1 text-left"
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                                                            {order.order_number ?? order.source_order_id}
                                                        </span>
                                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                                                            {order.mapped_payment_method ?? order.payment_method ?? "—"}
                                                        </span>
                                                    </div>
                                                    <p
                                                        className="mt-1 text-xs font-medium text-slate-600 truncate"
                                                        title={order.customer_name || order.source_order_id}
                                                    >
                                                        {shortName(order.customer_name) || order.source_order_id}
                                                    </p>
                                                    {order.payment_time && (
                                                        <p className="mt-0.5 text-xs text-slate-400">
                                                            {order.payment_time}
                                                        </p>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                                                            {d.beforeTax}
                                                        </span>
                                                        <span className="text-xs font-semibold tabular-nums text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/50">
                                                            {money.format(order.amount_before_tax ?? 0)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                                                            {d.vat}
                                                        </span>
                                                        <span className="text-xs font-semibold tabular-nums text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/50">
                                                            {money.format(order.tax_money ?? 0)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col text-right">
                                                    <span className="text-[11px] text-sky-800 uppercase tracking-wider font-bold">
                                                        {d.totalMoney}
                                                    </span>
                                                    <span className="text-sm sm:text-base font-bold tabular-nums text-sky-700 bg-sky-50 px-3 py-1 rounded-lg border border-sky-200/80 shadow-2xs">
                                                        {money.format(order.real_money ?? 0)}
                                                    </span>
                                                </div>

                                                <div className="flex flex-col items-end gap-1">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(order.preflight.status)}`}
                                                    >
                                                        {statusLabel(order.preflight.status, lang)}
                                                    </span>
                                                    {order.invoice_document_status && (
                                                        <span className="text-xs font-semibold text-slate-500">
                                                            {documentStatusLabel(order.invoice_document_status, lang)}
                                                        </span>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedOrder(order)}
                                                    aria-label={d.detail}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {selectedOrder && (
                        <OrderReviewSheet
                            order={selectedOrder}
                            lang={lang}
                            labels={d}
                            canPrepare={hasPermission("invoices.prepare", selectedOrder.warehouse_id)}
                            onChanged={loadOrders}
                            onClose={() => setSelectedOrder(null)}
                        />
                    )}
                </>
            ) : view === "MISA" ? (
                <MisaInvoicePanel
                    warehouseId={activeStoreId}
                    businessDate={businessDate}
                    refreshToken={syncResult?.id ?? ""}
                />
            ) : (
                <InvoiceLedgerPanel
                    warehouseId={activeStoreId}
                    businessDate={businessDate}
                    mode={view === "RECONCILIATION" ? "RECONCILIATION" : "ISSUED"}
                    refreshToken={syncResult?.id ?? ""}
                    canDownload={hasPermission("invoices.download", activeStoreId)}
                    canResolve={hasPermission("invoices.reconcile", activeStoreId)}
                />
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {label}
            </span>
            {children}
        </label>
    );
}

function OrderReviewSheet({
    order,
    lang,
    labels,
    canPrepare,
    onChanged,
    onClose,
}: {
    order: InvoiceSourceOrderView;
    lang: "vi" | "zh";
    labels: typeof copy.vi | typeof copy.zh;
    canPrepare: boolean;
    onChanged: () => Promise<void>;
    onClose: () => void;
}) {
    const [isDesktop, setIsDesktop] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 1024px)");
        const handleChange = (event: MediaQueryListEvent) => {
            setIsDesktop(event.matches);
        };

        setIsDesktop(mediaQuery.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    useEffect(() => {
        if (!isDesktop) return;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isDesktop, onClose]);

    const content = (
        <div className="pt-2">
            <p className="text-xxs font-semibold uppercase tracking-wider text-slate-400">
                {labels.detail} · {order.payment_time ?? "—"}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
                <MoneyCell
                    label={labels.beforeTax}
                    value={order.calculation?.total_amount_without_vat ?? order.amount_before_tax ?? 0}
                />
                <MoneyCell label={labels.vat} value={order.calculation?.total_vat_amount ?? order.tax_money ?? 0} />
                <MoneyCell
                    label={labels.totalMoney}
                    value={order.calculation?.total_amount ?? order.real_money ?? 0}
                    strong
                />
            </div>

            <section className="mt-5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{labels.issues}</h3>
                    <span
                        className={`rounded-full border px-2.5 py-0.5 text-xxs font-semibold ${statusStyle(order.preflight.status)}`}
                    >
                        {statusLabel(order.preflight.status, lang)}
                    </span>
                </div>
                {order.preflight.issues.length === 0 ? (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-xs font-medium text-emerald-800">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> {labels.noIssues}
                    </div>
                ) : (
                    <div className="mt-2 grid gap-2">
                        {order.preflight.issues.map((item, index) => (
                            <div
                                key={`${item.code}-${index}`}
                                className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3"
                            >
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                                    <AlertTriangle size={14} className="shrink-0" /> {item.code}
                                </div>
                                <p className="mt-1 text-xs text-amber-900 leading-snug">{item.message}</p>
                                <p className="mt-1 font-mono text-[10px] text-amber-700 break-all">{item.path}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {labels.sourceItems} ({order.normalized_items.length})
                </h3>
                <div className="mt-2 grid gap-2">
                    {(order.calculation?.lines ?? order.normalized_items).map((item, index) => (
                        <div
                            key={`${item.line_number}-${index}`}
                            className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs max-w-full"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-slate-900">{item.item_name ?? "—"}</p>
                                    <p className="mt-0.5 font-mono text-xxs text-slate-400">
                                        {item.item_code ?? item.source_item_id ?? "—"}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xxs font-bold text-slate-700">
                                    {item.vat_rate_name ?? "VAT ?"}
                                </span>
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
                                <span className="font-medium text-slate-500">
                                    {item.quantity ?? 0} {item.unit_name ?? "—"} × {money.format(item.unit_price ?? 0)}
                                </span>
                                {"total_amount" in item && typeof item.total_amount === "number" && (
                                    <span className="font-bold text-slate-900 tabular-nums">
                                        {money.format(item.total_amount)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="mt-5 border-t border-slate-200/80 pt-4">
                <InvoiceDraftWorkflow order={order} lang={lang} canPrepare={canPrepare} onChanged={onChanged} />
            </div>
        </div>
    );

    if (!isDesktop) {
        return (
            <BottomSheet
                isOpen={Boolean(order)}
                onClose={onClose}
                title={order.order_number ?? order.source_order_id}
                defaultSnap="full"
                mobileBreakpoint="lg"
                contentClassName="flex-1 overflow-y-auto px-4 pb-8 space-y-5"
            >
                {content}
            </BottomSheet>
        );
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-order-detail-title"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
                <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-micro font-bold uppercase tracking-wider text-sky-700">{labels.detail}</p>
                        <h2
                            id="invoice-order-detail-title"
                            className="mt-0.5 truncate text-base font-bold text-slate-950"
                        >
                            {order.order_number ?? order.source_order_id}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">{order.payment_time ?? "—"}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label={labels.close}
                    >
                        <X size={19} />
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">{content}</div>
            </div>
        </div>,
        document.body,
    );
}

function StatCard({
    label,
    value,
    icon,
    tone = "default",
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone?: "default" | "success" | "warning" | "danger";
}) {
    const tones = {
        default: "bg-slate-100 text-slate-700",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-700",
        danger: "bg-rose-100 text-rose-700",
    };
    return (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
            <div>
                <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
            </div>
        </div>
    );
}

function MoneyCell({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div className={`rounded-lg p-3 ${strong ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}>
            <p className={`text-[11px] ${strong ? "text-slate-300" : "text-slate-500"}`}>{label}</p>
            <p className="mt-1 text-sm font-bold tabular-nums sm:text-base">{money.format(value)}</p>
        </div>
    );
}

function MobileMoney({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div className={strong ? "text-slate-900" : "text-slate-600"}>
            <p className="truncate text-[10px] text-slate-400">{label}</p>
            <p className="mt-0.5 truncate font-bold tabular-nums">{money.format(value)}</p>
        </div>
    );
}

function ErrorNotificationCard({
    error,
    loading,
    onRetry,
    onDismiss,
    d,
}: {
    error: string;
    loading: boolean;
    onRetry: () => void;
    onDismiss?: () => void;
    d: (typeof copy)["vi"] | (typeof copy)["zh"];
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50/95 via-rose-50/50 to-white p-3.5 shadow-xs transition-all">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-rose-200/60 bg-rose-100 text-rose-600 shadow-2xs">
                        <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-rose-950">{d.errorTitle}</h4>
                            <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                                Error
                            </span>
                        </div>
                        <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{error}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={loading}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300/80 bg-white px-3 text-xs font-semibold text-rose-900 shadow-2xs transition hover:bg-rose-100/60 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={13} className={loading ? "animate-spin text-rose-600" : "text-rose-600"} />
                        <span>{d.retry}</span>
                    </button>
                    {onDismiss && (
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-100/80 hover:text-rose-800 transition active:scale-95 cursor-pointer"
                            title={d.dismiss}
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function SyncResultCard({
    syncResult,
    onDismiss,
    d,
}: {
    syncResult: InvoiceSyncResult;
    onDismiss?: () => void;
    d: (typeof copy)["vi"] | (typeof copy)["zh"];
}) {
    const reco = syncResult.reconciliation?.summary;

    return (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/80 via-white to-slate-50/30 p-3.5 shadow-xs space-y-3.5">
            {/* Ambient subtle top line accent */}

            {/* Header: Title, Order counter badge, Dismiss */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-2xs">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{d.syncDone}</h4>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-800">
                                {syncResult.order_count} {d.order}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">{d.syncDescription}</p>
                    </div>
                </div>

                {onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95 cursor-pointer"
                        title={d.dismiss}
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* HKAPI Sync Counters (New, Updated, Unchanged) */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-1 text-xs shadow-2xs">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-900">{d.inserted}:</span>
                    <span className="text-sm font-bold tabular-nums text-emerald-950">{syncResult.inserted_count}</span>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50/60 px-2.5 py-1 text-xs shadow-2xs">
                    <span className="size-2 rounded-full bg-sky-500" />
                    <span className="text-xs font-medium text-sky-900">{d.updated}:</span>
                    <span className="text-sm font-bold tabular-nums text-sky-950">{syncResult.updated_count}</span>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-xs shadow-2xs">
                    <span className="size-2 rounded-full bg-slate-400" />
                    <span className="text-xs font-medium text-slate-700">{d.unchanged}:</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900">{syncResult.unchanged_count}</span>
                </div>
            </div>

            {/* MISA Reconciliation Dashboard Matrix */}
            {reco && (
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-2.5 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xxs font-bold uppercase tracking-wider text-slate-600">
                            {d.syncDetailsTitle}
                        </span>
                        <span className="text-xxs font-semibold text-emerald-700">MISA meInvoice</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        <ReconciliationTile label={d.matchedMisa} value={reco.matched_count} tone="emerald" />
                        <ReconciliationTile label={d.misaReturned} value={reco.misa_invoice_count} tone="sky" />
                        <ReconciliationTile label={d.notIssued} value={reco.source_not_in_misa_count} tone="slate" />
                        <ReconciliationTile
                            label={d.mismatches}
                            value={reco.mismatch_count + reco.misa_not_in_source_count}
                            tone="rose"
                        />
                        <ReconciliationTile label={d.unlinked} value={reco.unscoped_misa_count} tone="amber" />
                    </div>
                </div>
            )}
        </div>
    );
}

function ReconciliationTile({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "emerald" | "sky" | "slate" | "rose" | "amber";
}) {
    const toneStyles = {
        emerald: {
            border: "border-emerald-200/80 hover:border-emerald-300",
            bg: "bg-emerald-50/40",
            text: "text-emerald-950",
            num: "text-emerald-700",
            indicator: "bg-emerald-500",
        },
        sky: {
            border: "border-sky-200/80 hover:border-sky-300",
            bg: "bg-sky-50/40",
            text: "text-sky-950",
            num: "text-sky-700",
            indicator: "bg-sky-500",
        },
        slate: {
            border: "border-slate-200/80 hover:border-slate-300",
            bg: "bg-slate-50/60",
            text: "text-slate-800",
            num: "text-slate-700",
            indicator: "bg-slate-400",
        },
        rose: {
            border: "border-rose-200/80 hover:border-rose-300",
            bg: "bg-rose-50/50",
            text: "text-rose-950",
            num: "text-rose-700",
            indicator: "bg-rose-500",
        },
        amber: {
            border: "border-amber-200/80 hover:border-amber-300",
            bg: "bg-amber-50/50",
            text: "text-amber-950",
            num: "text-amber-700",
            indicator: "bg-amber-500",
        },
    };

    const style = toneStyles[tone];

    return (
        <div
            className={`flex flex-col justify-between rounded-lg border p-2 transition-all shadow-2xs ${style.border} ${style.bg}`}
        >
            <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xxs font-semibold text-slate-600">{label}</span>
                <span className={`size-1.5 rounded-full shrink-0 ${style.indicator}`} />
            </div>
            <p className={`mt-1.5 text-base font-bold tabular-nums ${style.num}`}>{value}</p>
        </div>
    );
}
