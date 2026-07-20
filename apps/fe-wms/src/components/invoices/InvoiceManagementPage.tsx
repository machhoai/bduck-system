"use client";

import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    FileWarning,
    LoaderCircle,
    RefreshCw,
    ReceiptText,
    Search,
    Send,
    ShieldCheck,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    InvoiceDocumentStatus,
    InvoiceIssueJobStatus,
    InvoiceOrderSyncPurpose,
    InvoicePreparationStatus,
} from "@bduck/shared-types";
import {
    invoiceApi,
    type InvoiceSourceOrderView,
    type InvoiceIssueJobView,
    type InvoiceSyncResult,
} from "@/api/invoiceApi";
import { useStores } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { showToast } from "@/utils/toast";
import { InvoiceDraftWorkflow } from "./InvoiceDraftWorkflow";
import { InvoiceLedgerPanel } from "./InvoiceLedgerPanel";

const copy = {
    vi: {
        eyebrow: "MISA meInvoice",
        title: "Quản lý hóa đơn",
        subtitle:
            "Đồng bộ toàn bộ đơn trong ngày, kiểm tra số liệu và xem trước trước khi phát hành.",
        store: "Cửa hàng",
        date: "Ngày giao dịch",
        purpose: "Mục đích đồng bộ",
        issue: "Chuẩn bị phát hành",
        reconciliation: "Đối chiếu",
        sync: "Đồng bộ toàn ngày",
        syncing: "Đang đồng bộ…",
        total: "Tổng đơn",
        ready: "Sẵn sàng review",
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
        inserted: "mới",
        updated: "thay đổi",
        unchanged: "không đổi",
        retry: "Thử lại",
        syncFailed: "Đồng bộ hóa đơn thất bại",
        syncDescription:
            "Toàn bộ đơn hàng trong ngày đã được lưu và tính lại preflight.",
        previewReady: "Đã tạo bản xem trước",
        previewFailed: "Không thể xem trước hóa đơn",
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
        ready: "可审核",
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
    if (status === InvoicePreparationStatus.READY_FOR_REVIEW) {
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
            [InvoicePreparationStatus.READY_FOR_REVIEW]: "Sẵn sàng review",
            [InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION]: "Thiếu cấu hình thuế",
            [InvoicePreparationStatus.NEEDS_REVIEW]: "Cần xử lý",
        },
        zh: {
            [InvoicePreparationStatus.READY_FOR_REVIEW]: "可审核",
            [InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION]: "缺少税务配置",
            [InvoicePreparationStatus.NEEDS_REVIEW]: "需要处理",
        },
    };
    return values[lang][status] ?? status;
};

const documentStatusLabel = (
    status: InvoiceDocumentStatus,
    lang: "vi" | "zh",
) => {
    const values: Record<
        "vi" | "zh",
        Partial<Record<InvoiceDocumentStatus, string>>
    > = {
        vi: {
            NEEDS_TAX_CONFIGURATION: "Draft thiếu cấu hình thuế",
            NEEDS_REVIEW: "Draft cần duyệt",
            NEEDS_SECOND_REVIEW: "Draft cần duyệt lần hai",
            READY_TO_ISSUE: "Draft sẵn sàng phát hành",
            REJECTED: "Draft đã từ chối",
        },
        zh: {
            NEEDS_TAX_CONFIGURATION: "草稿缺少税务配置",
            NEEDS_REVIEW: "草稿待审核",
            NEEDS_SECOND_REVIEW: "草稿待二次审核",
            READY_TO_ISSUE: "草稿可开票",
            REJECTED: "草稿已拒绝",
        },
    };
    return values[lang][status] ?? status;
};

export default function InvoiceManagementPage() {
    const { lang } = useTranslation();
    const d = copy[lang];
    const { stores, loading: storesLoading } = useStores();
    const hasPermission = useUserStore((state) => state.hasPermission);
    const [view, setView] = useState<"PENDING" | "ISSUED" | "RECONCILIATION">(() => {
        const value = initialQueryValue("tab");
        return value === "ISSUED" || value === "RECONCILIATION" ? value : "PENDING";
    });
    const [selectedStoreId, setSelectedStoreId] = useState(() =>
        initialQueryValue("store"),
    );
    const activeStoreId = stores.some((store) => store.id === selectedStoreId)
        ? selectedStoreId
        : (stores[0]?.id ?? "");
    const [businessDate, setBusinessDate] = useState(() =>
        initialQueryValue("date", todayInVietnam()),
    );
    const [purpose, setPurpose] = useState<InvoiceOrderSyncPurpose>(() =>
        initialQueryValue("purpose") === InvoiceOrderSyncPurpose.RECONCILIATION
            ? InvoiceOrderSyncPurpose.RECONCILIATION
            : InvoiceOrderSyncPurpose.ISSUE,
    );
    const [orders, setOrders] = useState<InvoiceSourceOrderView[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [selectedOrder, setSelectedOrder] =
        useState<InvoiceSourceOrderView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<InvoiceSyncResult | null>(null);
    const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
    const [issuing, setIssuing] = useState(false);
    const [issueJob, setIssueJob] = useState<InvoiceIssueJobView | null>(null);
    const issueRequestKey = useRef<string | null>(null);
    const [query, setQuery] = useState(() => initialQueryValue("q"));
    const [statusFilter, setStatusFilter] = useState<
        "ALL" | InvoicePreparationStatus
    >(() => {
        const value = initialQueryValue("status");
        return Object.values(InvoicePreparationStatus).includes(
            value as InvoicePreparationStatus,
        )
            ? (value as InvoicePreparationStatus)
            : "ALL";
    });
    const loadGeneration = useRef(0);

    const loadOrders = useCallback(async () => {
        const generation = ++loadGeneration.current;
        if (!activeStoreId || !businessDate) {
            setOrders([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const nextOrders = await invoiceApi.listSourceOrders(
                activeStoreId,
                businessDate,
            );
            if (generation === loadGeneration.current) setOrders(nextOrders);
        } catch (loadError) {
            if (generation !== loadGeneration.current) return;
            setOrders([]);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Unable to load invoices.",
            );
        } finally {
            if (generation === loadGeneration.current) setLoading(false);
        }
    }, [activeStoreId, businessDate]);

    useEffect(() => {
        void loadOrders();
        return () => {
            loadGeneration.current += 1;
        };
    }, [loadOrders]);

    useEffect(() => {
        setSelectedIssueIds([]);
        setIssueJob(null);
        issueRequestKey.current = null;
    }, [activeStoreId, businessDate]);

    useEffect(() => {
        if (!issueJob) return;
        if (
            [
                InvoiceIssueJobStatus.COMPLETED,
                InvoiceIssueJobStatus.PARTIAL,
                InvoiceIssueJobStatus.FAILED,
                InvoiceIssueJobStatus.CANCELLED,
            ].includes(issueJob.status)
        ) return;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const next = await invoiceApi.getIssueJob(issueJob.id, activeStoreId);
                if (!cancelled) {
                    setIssueJob(next);
                    if (
                        [
                            InvoiceIssueJobStatus.COMPLETED,
                            InvoiceIssueJobStatus.PARTIAL,
                            InvoiceIssueJobStatus.FAILED,
                        ].includes(next.status)
                    ) await loadOrders();
                }
            } catch (pollError) {
                if (!cancelled) {
                    setError(
                        pollError instanceof Error
                            ? pollError.message
                            : "Unable to refresh issue job.",
                    );
                }
            }
        }, 2500);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [activeStoreId, issueJob, loadOrders]);

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
        window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${next ? `?${next}` : ""}`,
        );
    }, [activeStoreId, businessDate, purpose, query, statusFilter, view]);

    const handleSync = async () => {
        if (!activeStoreId) return;
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            const operation = invoiceApi
                .syncSourceOrders(activeStoreId, businessDate, purpose)
                .then(async (result) => {
                    setSyncResult(result);
                    await loadOrders();
                    return result;
                });
            await showToast.promise(operation, {
                loading: d.syncing,
                success: d.syncDone,
                error: d.syncFailed,
                successDescription: d.syncDescription,
                errorDescription: (toastError) =>
                    toastError instanceof Error ? toastError.message : d.syncFailed,
            });
        } catch (syncError) {
            setError(
                syncError instanceof Error
                    ? syncError.message
                    : "Unable to sync invoices.",
            );
        } finally {
            setSyncing(false);
        }
    };

    const stats = useMemo(
        () => ({
            total: orders.length,
            ready: orders.filter(
                (order) =>
                    order.preflight.status === InvoicePreparationStatus.READY_FOR_REVIEW,
            ).length,
            tax: orders.filter(
                (order) =>
                    order.preflight.status ===
                    InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION,
            ).length,
            review: orders.filter(
                (order) =>
                    order.preflight.status === InvoicePreparationStatus.NEEDS_REVIEW,
            ).length,
        }),
        [orders],
    );

    const filteredOrders = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase(lang);
        return orders.filter((order) => {
            if (statusFilter !== "ALL" && order.preflight.status !== statusFilter)
                return false;
            if (!normalizedQuery) return true;
            return [order.order_number, order.source_order_id, order.customer_name]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLocaleLowerCase(lang).includes(normalizedQuery),
                );
        });
    }, [lang, orders, query, statusFilter]);

    const canSync =
        purpose === InvoiceOrderSyncPurpose.ISSUE
            ? hasPermission("invoices.prepare", activeStoreId)
            : hasPermission("invoices.reconcile", activeStoreId);
    const canIssue = hasPermission("invoices.issue", activeStoreId);
    const issueEligibleIds = filteredOrders
        .filter(
            (order) =>
                order.invoice_document_status ===
                InvoiceDocumentStatus.READY_TO_ISSUE &&
                Boolean(order.invoice_document_id),
        )
        .map((order) => order.invoice_document_id!);
    const selectableIssueIds = issueEligibleIds.slice(0, 30);
    const selectedEligibleIds = selectedIssueIds.filter((id) =>
        selectableIssueIds.includes(id),
    );

    const toggleIssueId = (id: string) => {
        issueRequestKey.current = null;
        setSelectedIssueIds((current) =>
            current.includes(id)
                ? current.filter((value) => value !== id)
                : current.length < 30
                    ? [...current, id]
                    : current,
        );
    };

    const handleIssue = async () => {
        if (
            !activeStoreId ||
            !canIssue ||
            selectedEligibleIds.length === 0 ||
            issuing
        ) return;
        const message =
            lang === "vi"
                ? `Bạn sắp gửi ${selectedEligibleIds.length} hóa đơn thật sang MISA. Hãy xác nhận các draft đã được đối chiếu và thuộc thời điểm go-live.`
                : `You are about to send ${selectedEligibleIds.length} real invoices to MISA. Confirm they were reconciled and are after go-live.`;
        if (!window.confirm(message)) return;
        setIssuing(true);
        setError(null);
        try {
            issueRequestKey.current ??= crypto.randomUUID();
            const job = await invoiceApi.createIssueJob(
                activeStoreId,
                selectedEligibleIds,
                issueRequestKey.current,
            );
            setIssueJob(job);
            setSelectedIssueIds([]);
        } catch (issueError) {
            setError(
                issueError instanceof Error
                    ? issueError.message
                    : "Unable to create issue job.",
            );
        } finally {
            setIssuing(false);
        }
    };

    if (!storesLoading && stores.length === 0) {
        return (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-6 text-center">
                <ReceiptText
                    className="mb-3 text-[var(--color-text-muted)]"
                    size={40}
                />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {d.noStore}
                </p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4 pb-6">
            <header className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="border-b border-[var(--color-border-subtle)] bg-[linear-gradient(120deg,#0f172a,#163a5f)] px-4 py-5 text-white sm:px-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
                        {d.eyebrow}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold">{d.title}</h1>
                    <p className="mt-1 max-w-[80%] text-sm text-slate-300">{d.subtitle}</p>
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_minmax(260px,1fr)_auto] lg:items-end">
                    <Field label={d.store}>
                        <select
                            value={activeStoreId}
                            onChange={(event) => setSelectedStoreId(event.target.value)}
                            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-brand-primary)]"
                        >
                            {stores.map((store) => (
                                <option key={store.id} value={store.id}>
                                    {store.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label={d.date}>
                        <input
                            type="date"
                            value={businessDate}
                            onChange={(event) => setBusinessDate(event.target.value)}
                            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-brand-primary)]"
                        />
                    </Field>
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
                                    className={`h-8 rounded-md px-2 text-xs font-semibold transition ${purpose === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={!canSync || syncing || !activeStoreId}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {syncing ? (
                            <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                            <RefreshCw size={16} />
                        )}
                        {syncing ? d.syncing : d.sync}
                    </button>
                </div>
            </header>

            <nav className="flex gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-1" aria-label="Invoice views">
                {([
                    ["PENDING", lang === "vi" ? "Chờ phát hành" : "Pending"],
                    ["ISSUED", lang === "vi" ? "Đã phát hành" : "Issued"],
                    ["RECONCILIATION", lang === "vi" ? "Lỗi / Đối chiếu" : "Reconciliation"],
                ] as const).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => {
                            setView(value);
                            if (value === "RECONCILIATION") setPurpose(InvoiceOrderSyncPurpose.RECONCILIATION);
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${view === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {error && (
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <AlertTriangle size={17} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button
                        type="button"
                        onClick={() => void loadOrders()}
                        disabled={loading}
                        className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                        {d.retry}
                    </button>
                </div>
            )}
            {syncResult && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 size={17} />
                    <strong>
                        {d.syncDone}: {syncResult.order_count}
                    </strong>
                    <span>
                        {syncResult.inserted_count} {d.inserted}
                    </span>
                    <span>
                        {syncResult.updated_count} {d.updated}
                    </span>
                    <span>
                        {syncResult.unchanged_count} {d.unchanged}
                    </span>
                    {syncResult.reconciliation && (
                        <>
                            <span className="h-4 w-px bg-emerald-300" />
                            <span>
                                {lang === "vi" ? "Khớp MISA" : "Matched"}: {syncResult.reconciliation.summary.matched_count}
                            </span>
                            <span>
                                {lang === "vi" ? "Chưa xuất" : "Not issued"}: {syncResult.reconciliation.summary.source_not_in_misa_count}
                            </span>
                            <span>
                                {lang === "vi" ? "Sai lệch" : "Mismatches"}: {syncResult.reconciliation.summary.mismatch_count + syncResult.reconciliation.summary.misa_not_in_source_count}
                            </span>
                        </>
                    )}
                </div>
            )}

            {view === "PENDING" ? <>
                {(selectedEligibleIds.length > 0 || issueJob) && (
                    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                        {issueJob ? (
                            <>
                                <strong>
                                    {lang === "vi" ? "Tiến độ phát hành" : "Issue progress"}: {issueJob.status}
                                </strong>
                                <span>{issueJob.counts.issued} {lang === "vi" ? "đã phát hành" : "issued"}</span>
                                <span>{issueJob.counts.pending_confirmation} {lang === "vi" ? "chờ xác nhận" : "pending"}</span>
                                <span>
                                    {issueJob.counts.manual_reconciliation + issueJob.counts.retryable_error}{" "}
                                    {lang === "vi" ? "cần xử lý" : "need attention"}
                                </span>
                            </>
                        ) : (
                            <span className="font-semibold">
                                {selectedEligibleIds.length} {lang === "vi" ? "hóa đơn đã chọn" : "invoices selected"}
                            </span>
                        )}
                        {selectedEligibleIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => void handleIssue()}
                                disabled={!canIssue || issuing}
                                className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-sky-700 px-3 text-xs font-bold text-white disabled:opacity-50"
                            >
                                {issuing ? (
                                    <LoaderCircle className="animate-spin" size={15} />
                                ) : (
                                    <Send size={15} />
                                )}
                                {issuing
                                    ? lang === "vi" ? "Đang tạo job…" : "Creating job…"
                                    : lang === "vi" ? "Phát hành hóa đơn đã chọn" : "Issue selected invoices"}
                            </button>
                        )}
                    </div>
                )}

                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                        label={d.total}
                        value={stats.total}
                        icon={<ReceiptText size={18} />}
                    />
                    <StatCard
                        label={d.ready}
                        value={stats.ready}
                        icon={<ShieldCheck size={18} />}
                        tone="success"
                    />
                    <StatCard
                        label={d.tax}
                        value={stats.tax}
                        icon={<FileWarning size={18} />}
                        tone="warning"
                    />
                    <StatCard
                        label={d.review}
                        value={stats.review}
                        icon={<AlertTriangle size={18} />}
                        tone="danger"
                    />
                </section>

                <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                    <div className="flex flex-col gap-2 border-b border-[var(--color-border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1 sm:max-w-[80%]">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                size={16}
                            />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={d.search}
                                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value as typeof statusFilter)
                            }
                            className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold outline-none"
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
                        <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
                            <LoaderCircle className="animate-spin" size={18} /> {d.loading}
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                            <ReceiptText size={36} className="mb-3 text-slate-300" />
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {d.empty}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                {d.emptyHint}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-2 p-3 md:hidden">
                                {filteredOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="relative rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white shadow-sm"
                                    >
                                        {order.invoice_document_status ===
                                            InvoiceDocumentStatus.READY_TO_ISSUE &&
                                            order.invoice_document_id && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIssueIds.includes(
                                                        order.invoice_document_id,
                                                    )}
                                                    disabled={
                                                        !selectedIssueIds.includes(order.invoice_document_id) &&
                                                        selectedIssueIds.length >= 30
                                                    }
                                                    onChange={() =>
                                                        toggleIssueId(order.invoice_document_id!)
                                                    }
                                                    aria-label={
                                                        lang === "vi"
                                                            ? "Chọn hóa đơn để phát hành"
                                                            : "Select invoice to issue"
                                                    }
                                                    className="absolute left-3 top-4 z-10 h-4 w-4 accent-sky-700"
                                                />
                                            )}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedOrder(order)}
                                            className={`w-full p-3 text-left ${order.invoice_document_status === InvoiceDocumentStatus.READY_TO_ISSUE ? "pl-10" : ""}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-slate-900">
                                                        {order.order_number ?? order.source_order_id}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-xs text-slate-500">
                                                        {order.customer_name || order.source_order_id}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusStyle(order.preflight.status)}`}
                                                >
                                                    {order.invoice_document_status
                                                        ? documentStatusLabel(
                                                            order.invoice_document_status,
                                                            lang,
                                                        )
                                                        : statusLabel(order.preflight.status, lang)}
                                                </span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                                <MobileMoney
                                                    label={d.beforeTax}
                                                    value={order.amount_before_tax ?? 0}
                                                />
                                                <MobileMoney label={d.vat} value={order.tax_money ?? 0} />
                                                <MobileMoney
                                                    label={d.totalMoney}
                                                    value={order.real_money ?? 0}
                                                    strong
                                                />
                                            </div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="min-w-[960px] w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        selectableIssueIds.length > 0 &&
                                                        selectableIssueIds.every((id) =>
                                                            selectedIssueIds.includes(id),
                                                        )
                                                    }
                                                    onChange={() => {
                                                        issueRequestKey.current = null;
                                                        setSelectedIssueIds(
                                                            selectableIssueIds.every((id) =>
                                                                selectedIssueIds.includes(id),
                                                            )
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
                                                    className="h-4 w-4 accent-sky-700"
                                                />
                                            </th>
                                            {[
                                                d.order,
                                                d.payment,
                                                d.beforeTax,
                                                d.vat,
                                                d.totalMoney,
                                                d.status,
                                                "",
                                            ].map((label, index) => (
                                                <th
                                                    key={`${label}-${index}`}
                                                    className="px-4 py-3 font-semibold"
                                                >
                                                    {label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                        {filteredOrders.map((order) => (
                                            <tr
                                                key={order.id}
                                                className="transition hover:bg-slate-50/80"
                                            >
                                                <td className="px-4 py-3">
                                                    {order.invoice_document_status ===
                                                        InvoiceDocumentStatus.READY_TO_ISSUE &&
                                                        order.invoice_document_id && (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIssueIds.includes(
                                                                    order.invoice_document_id,
                                                                )}
                                                                disabled={
                                                                    !selectedIssueIds.includes(
                                                                        order.invoice_document_id,
                                                                    ) && selectedIssueIds.length >= 30
                                                                }
                                                                onChange={() =>
                                                                    toggleIssueId(order.invoice_document_id!)
                                                                }
                                                                aria-label={
                                                                    lang === "vi"
                                                                        ? "Chọn hóa đơn để phát hành"
                                                                        : "Select invoice to issue"
                                                                }
                                                                className="h-4 w-4 accent-sky-700"
                                                            />
                                                        )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="text-left"
                                                    >
                                                        <span className="block font-semibold text-slate-900">
                                                            {order.order_number ?? order.source_order_id}
                                                        </span>
                                                        <span className="mt-0.5 block max-w-64 truncate text-xs text-slate-500">
                                                            {order.customer_name || order.source_order_id}
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    <span className="block">
                                                        {order.mapped_payment_method ??
                                                            order.payment_method ??
                                                            "—"}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {order.payment_time ?? "—"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium tabular-nums">
                                                    {money.format(order.amount_before_tax ?? 0)}
                                                </td>
                                                <td className="px-4 py-3 font-medium tabular-nums">
                                                    {money.format(order.tax_money ?? 0)}
                                                </td>
                                                <td className="px-4 py-3 font-bold tabular-nums text-slate-900">
                                                    {money.format(order.real_money ?? 0)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusStyle(order.preflight.status)}`}
                                                    >
                                                        {statusLabel(order.preflight.status, lang)}
                                                    </span>
                                                    {order.invoice_document_status && (
                                                        <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                                                            {documentStatusLabel(
                                                                order.invoice_document_status,
                                                                lang,
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedOrder(order)}
                                                        aria-label={d.detail}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                                    >
                                                        <ChevronRight size={17} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>

                {selectedOrder && (
                    <OrderReviewDrawer
                        order={selectedOrder}
                        lang={lang}
                        labels={d}
                        canPrepare={hasPermission(
                            "invoices.prepare",
                            selectedOrder.warehouse_id,
                        )}
                        canReview={hasPermission(
                            "invoices.review",
                            selectedOrder.warehouse_id,
                        )}
                        onChanged={loadOrders}
                        onClose={() => setSelectedOrder(null)}
                    />
                )}
            </> : (
                <InvoiceLedgerPanel
                    warehouseId={activeStoreId}
                    businessDate={businessDate}
                    mode={view}
                    refreshToken={syncResult?.id ?? ""}
                    canDownload={hasPermission("invoices.download", activeStoreId)}
                    canResolve={hasPermission("invoices.reconcile", activeStoreId)}
                />
            )}
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {label}
            </span>
            {children}
        </label>
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
            <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}
            >
                {icon}
            </span>
            <div>
                <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
            </div>
        </div>
    );
}

function OrderReviewDrawer({
    order,
    lang,
    labels,
    canPrepare,
    canReview,
    onChanged,
    onClose,
}: {
    order: InvoiceSourceOrderView;
    lang: "vi" | "zh";
    labels: typeof copy.vi | typeof copy.zh;
    canPrepare: boolean;
    canReview: boolean;
    onChanged: () => Promise<void>;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-slate-950/45"
            role="dialog"
            aria-modal="true"
        >
            <button
                type="button"
                aria-label={labels.close}
                onClick={onClose}
                className="absolute inset-0 cursor-default"
            />
            <aside className="relative flex h-full w-full max-w-[80%] flex-col bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 p-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {labels.detail}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                            {order.order_number ?? order.source_order_id}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            {order.payment_time ?? "—"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                        aria-label={labels.close}
                    >
                        <X size={19} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-3 gap-2">
                        <MoneyCell
                            label={labels.beforeTax}
                            value={
                                order.calculation?.total_amount_without_vat ??
                                order.amount_before_tax ??
                                0
                            }
                        />
                        <MoneyCell
                            label={labels.vat}
                            value={
                                order.calculation?.total_vat_amount ?? order.tax_money ?? 0
                            }
                        />
                        <MoneyCell
                            label={labels.totalMoney}
                            value={order.calculation?.total_amount ?? order.real_money ?? 0}
                            strong
                        />
                    </div>

                    <section className="mt-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">
                                {labels.issues}
                            </h3>
                            <span
                                className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusStyle(order.preflight.status)}`}
                            >
                                {statusLabel(order.preflight.status, lang)}
                            </span>
                        </div>
                        {order.preflight.issues.length === 0 ? (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                                <CheckCircle2 size={16} /> {labels.noIssues}
                            </div>
                        ) : (
                            <div className="mt-2 grid gap-2">
                                {order.preflight.issues.map((item, index) => (
                                    <div
                                        key={`${item.code}-${index}`}
                                        className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                                    >
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                                            <AlertTriangle size={14} /> {item.code}
                                        </div>
                                        <p className="mt-1 text-sm text-amber-900">
                                            {item.message}
                                        </p>
                                        <p className="mt-1 font-mono text-[11px] text-amber-700">
                                            {item.path}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="mt-5">
                        <h3 className="text-sm font-bold text-slate-900">
                            {labels.sourceItems} ({order.normalized_items.length})
                        </h3>
                        <div className="mt-2 grid gap-2">
                            {(order.calculation?.lines ?? order.normalized_items).map(
                                (item, index) => (
                                    <div
                                        key={`${item.line_number}-${index}`}
                                        className="rounded-lg border border-slate-200 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                    {item.item_name ?? "—"}
                                                </p>
                                                <p className="mt-0.5 font-mono text-xs text-slate-500">
                                                    {item.item_code ?? item.source_item_id ?? "—"}
                                                </p>
                                            </div>
                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                                                {item.vat_rate_name ?? "VAT ?"}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                            <span>
                                                {item.quantity ?? 0} {item.unit_name ?? "—"}
                                            </span>
                                            <span>{money.format(item.unit_price ?? 0)}</span>
                                            {"total_amount" in item &&
                                                typeof item.total_amount === "number" && (
                                                    <span className="font-semibold text-slate-900">
                                                        {money.format(item.total_amount)}
                                                    </span>
                                                )}
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </section>

                    <InvoiceDraftWorkflow
                        order={order}
                        lang={lang}
                        canPrepare={canPrepare}
                        canReview={canReview}
                        onChanged={onChanged}
                    />
                </div>
            </aside>
        </div>
    );
}

function MoneyCell({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: number;
    strong?: boolean;
}) {
    return (
        <div
            className={`rounded-lg p-3 ${strong ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}
        >
            <p
                className={`text-[11px] ${strong ? "text-slate-300" : "text-slate-500"}`}
            >
                {label}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums sm:text-base">
                {money.format(value)}
            </p>
        </div>
    );
}

function MobileMoney({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: number;
    strong?: boolean;
}) {
    return (
        <div className={strong ? "text-slate-900" : "text-slate-600"}>
            <p className="truncate text-[10px] text-slate-400">{label}</p>
            <p className="mt-0.5 truncate font-bold tabular-nums">
                {money.format(value)}
            </p>
        </div>
    );
}
