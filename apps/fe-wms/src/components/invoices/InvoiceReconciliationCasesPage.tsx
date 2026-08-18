"use client";

import {
  InvoiceDocumentStatus,
  InvoiceOrderSyncPurpose,
  InvoiceReconciliationCaseStatus,
  InvoiceReconciliationCaseType,
} from "@bduck/shared-types";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  invoiceApi,
  type InvoiceIssueRetryCandidate,
  type InvoiceLedgerEntryView,
  type InvoiceReconciliationCaseView,
} from "@/api/invoiceApi";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";
import { useStores } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import { showToast } from "@/utils/toast";

const PAGE_SIZE = 20;
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

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

const casePresentation: Record<
  InvoiceReconciliationCaseType,
  { title: string; description: string; tone: string }
> = {
  SOURCE_NOT_IN_MISA: {
    title: "Chưa tìm thấy hóa đơn trên MISA",
    description: "Đơn có trong hệ thống nhưng lần đối chiếu gần nhất chưa tìm thấy hóa đơn tương ứng trên MISA.",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  MISA_NOT_IN_SOURCE: {
    title: "Hóa đơn MISA không có đơn nguồn",
    description: "MISA có hóa đơn nhưng hệ thống chưa ghép được với đơn JPOS/HKAPI.",
    tone: "border-violet-200 bg-violet-50 text-violet-800",
  },
  LEDGER_MISMATCH: {
    title: "Dữ liệu hóa đơn không khớp",
    description: "Thông tin hoặc số tiền giữa sổ hóa đơn và MISA có sai lệch.",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  STATUS_MISMATCH: {
    title: "Trạng thái phát hành không khớp",
    description: "Hóa đơn đã có dấu vết trên MISA nhưng trạng thái phát hành chưa đúng như dự kiến.",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  MISA_INVOICE_DELETED: {
    title: "Hóa đơn đã bị xóa trên MISA",
    description: "MISA trả về trạng thái hóa đơn đã bị xóa.",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  TAX_REJECTED: {
    title: "Cơ quan thuế từ chối",
    description: "Hóa đơn có trên MISA nhưng không được cơ quan thuế chấp nhận.",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  MANUAL_REVIEW: {
    title: "Cần kiểm tra thủ công",
    description: "Hệ thống chưa thể tự kết luận và cần người phụ trách kiểm tra.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

const documentStatusLabel: Partial<Record<InvoiceDocumentStatus, string>> = {
  [InvoiceDocumentStatus.QUEUED]: "Đang chờ gửi",
  [InvoiceDocumentStatus.SUBMITTING]: "Đang gửi MISA",
  [InvoiceDocumentStatus.PENDING_CONFIRMATION]: "Đang chờ MISA xác nhận",
  [InvoiceDocumentStatus.RETRYABLE_ERROR]: "Hệ thống đang tự thử lại",
  [InvoiceDocumentStatus.MANUAL_RECONCILIATION]: "Cần xử lý thủ công",
  [InvoiceDocumentStatus.ISSUED]: "Đã phát hành",
  [InvoiceDocumentStatus.CANCELLED]: "Đã hủy",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
};

export default function InvoiceReconciliationCasesPage() {
  const { stores, loading: storesLoading } = useStores();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [selectedStoreId, setSelectedStoreId] = useState(() => initialQueryValue("store"));
  const activeStoreId = stores.some((store) => store.id === selectedStoreId)
    ? selectedStoreId
    : (stores[0]?.id ?? "");
  const [businessDate, setBusinessDate] = useState(() => initialQueryValue("date", todayInVietnam()));
  const [cases, setCases] = useState<InvoiceReconciliationCaseView[]>([]);
  const [ledger, setLedger] = useState<InvoiceLedgerEntryView[]>([]);
  const [retryCandidates, setRetryCandidates] = useState<InvoiceIssueRetryCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceReconciliationCaseStatus>(
    InvoiceReconciliationCaseStatus.OPEN,
  );
  const [typeFilter, setTypeFilter] = useState<"ALL" | InvoiceReconciliationCaseType>("ALL");
  const [page, setPage] = useState(1);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [retryCaseIds, setRetryCaseIds] = useState<string[]>([]);
  const [resolvingCase, setResolvingCase] = useState<InvoiceReconciliationCaseView | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const canReconcile = hasPermission("invoices.reconcile", activeStoreId);
  const canRetry = hasPermission("invoices.retry", activeStoreId);

  const load = useCallback(async () => {
    if (!activeStoreId || !businessDate) return;
    setLoading(true);
    setError(null);
    try {
      const [nextCases, nextLedger, nextCandidates] = await Promise.all([
        invoiceApi.listReconciliationCases(activeStoreId, businessDate),
        invoiceApi.listLedger(activeStoreId, businessDate),
        canRetry
          ? invoiceApi.listIssueRetryCandidates(activeStoreId, businessDate)
          : Promise.resolve([]),
      ]);
      setCases(nextCases);
      setLedger(nextLedger);
      setRetryCandidates(nextCandidates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách sai lệch.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, businessDate, canRetry]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedCaseIds([]);
    setPage(1);
  }, [activeStoreId, businessDate, query, statusFilter, typeFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (activeStoreId) params.set("store", activeStoreId);
    else params.delete("store");
    if (businessDate === todayInVietnam()) params.delete("date");
    else params.set("date", businessDate);
    const next = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
  }, [activeStoreId, businessDate]);

  const ledgerBySourceId = useMemo(
    () => new Map(ledger.map((item) => [item.id, item])),
    [ledger],
  );
  const candidateByDocumentId = useMemo(
    () => new Map(retryCandidates.map((item) => [item.invoice_document_id, item])),
    [retryCandidates],
  );
  const retryCandidateForCase = useCallback(
    (item: InvoiceReconciliationCaseView) =>
      item.type === InvoiceReconciliationCaseType.SOURCE_NOT_IN_MISA &&
      item.status === InvoiceReconciliationCaseStatus.OPEN &&
      item.invoice_document_id
        ? candidateByDocumentId.get(item.invoice_document_id) ?? null
        : null,
    [candidateByDocumentId],
  );

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return cases.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (!normalizedQuery) return true;
      const source = item.source_order_document_id
        ? ledgerBySourceId.get(item.source_order_document_id)
        : null;
      return [
        source?.order_number,
        source?.source_order_id,
        source?.customer_name,
        item.source_order_document_id,
        item.invoice_document_id,
        item.misa_ref_id,
        item.misa_transaction_id,
        casePresentation[item.type].title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("vi").includes(normalizedQuery));
    });
  }, [cases, ledgerBySourceId, query, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const paginatedCases = filteredCases.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const openCount = cases.filter((item) => item.status === InvoiceReconciliationCaseStatus.OPEN).length;
  const missingCount = cases.filter(
    (item) =>
      item.status === InvoiceReconciliationCaseStatus.OPEN &&
      item.type === InvoiceReconciliationCaseType.SOURCE_NOT_IN_MISA,
  ).length;
  const retryableCaseIds = cases.filter((item) => retryCandidateForCase(item)).map((item) => item.id);
  const selectedRetryableIds = selectedCaseIds.filter((id) => retryableCaseIds.includes(id));

  const startRetry = (caseIds: string[]) => {
    if (!canRetry || caseIds.length === 0) return;
    setRetryCaseIds(caseIds);
  };

  const submitRetry = async (otp: string) => {
    const selectedCandidates = retryCaseIds.flatMap((caseId) => {
      const item = cases.find((candidate) => candidate.id === caseId);
      const retryCandidate = item ? retryCandidateForCase(item) : null;
      return retryCandidate ? [retryCandidate] : [];
    });
    if (selectedCandidates.length === 0 || retrying) return;
    setRetrying(true);
    try {
      await showToast.promise(
        invoiceApi.retryRejectedIssueItems(
          activeStoreId,
          otp,
          selectedCandidates.map((item) => ({ job_id: item.job_id, item_id: item.item_id })),
        ),
        {
          loading: "Đang kiểm tra lại trên MISA…",
          success: "Đã đưa hóa đơn vào hàng đợi gửi lại",
          error: "Không thể gửi lại hóa đơn",
          successDescription: `${selectedCandidates.length} hóa đơn sẽ được gửi lại; hệ thống đã kiểm tra để tránh phát hành trùng.`,
          errorDescription: (retryError) =>
            retryError instanceof Error ? retryError.message : "Không thể gửi lại hóa đơn.",
        },
      );
      setRetryCaseIds([]);
      setSelectedCaseIds([]);
      await load();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Không thể gửi lại hóa đơn.");
    } finally {
      setRetrying(false);
    }
  };

  const runReconciliation = async () => {
    if (!canReconcile || reconciling) return;
    setReconciling(true);
    setError(null);
    try {
      await showToast.promise(
        invoiceApi.syncSourceOrders(
          activeStoreId,
          businessDate,
          InvoiceOrderSyncPurpose.RECONCILIATION,
        ),
        {
          loading: "Đang đồng bộ và đối chiếu MISA…",
          success: "Đối chiếu hoàn tất",
          error: "Không thể đối chiếu MISA",
          successDescription: "Danh sách case đã được cập nhật theo dữ liệu mới nhất.",
          errorDescription: (syncError) =>
            syncError instanceof Error ? syncError.message : "Không thể đối chiếu MISA.",
        },
      );
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Không thể đối chiếu MISA.");
    } finally {
      setReconciling(false);
    }
  };

  const submitResolve = async () => {
    if (!resolvingCase || resolutionNote.trim().length < 3 || resolving) return;
    setResolving(true);
    try {
      await invoiceApi.resolveReconciliationCase(
        resolvingCase.id,
        activeStoreId,
        resolutionNote.trim(),
      );
      showToast.success(
        "Đã đóng case đối chiếu",
        "Thao tác này chỉ lưu kết quả xử lý, không gửi lại hóa đơn.",
      );
      setResolvingCase(null);
      setResolutionNote("");
      await load();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Không thể đóng case đối chiếu.");
    } finally {
      setResolving(false);
    }
  };

  if (!storesLoading && stores.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Không có cửa hàng trong phạm vi được cấp quyền.</div>;
  }

  return (
    <div className="flex w-full flex-col gap-3 pb-6">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 bg-[linear-gradient(120deg,#0f172a,#163a5f)] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`/invoice-management?tab=RECONCILIATION&store=${encodeURIComponent(activeStoreId)}&date=${encodeURIComponent(businessDate)}`}
              className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-200 hover:text-white"
            >
              <ArrowLeft size={14} /> Quay lại quản lý hóa đơn
            </Link>
            <h1 className="text-lg font-bold">Xử lý sai lệch hóa đơn</h1>
            <p className="mt-0.5 text-xs text-slate-300">Tách riêng danh sách lỗi, kiểm tra nguyên nhân và gửi lại hóa đơn an toàn.</p>
          </div>
          <button
            type="button"
            onClick={() => void runReconciliation()}
            disabled={!canReconcile || reconciling || !activeStoreId}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-45"
          >
            {reconciling ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Đối chiếu lại MISA
          </button>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Cửa hàng
            <select
              value={activeStoreId}
              onChange={(event) => setSelectedStoreId(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold outline-none focus:border-sky-500"
            >
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Ngày giao dịch
            <input
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold outline-none focus:border-sky-500"
            />
          </label>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryCard label="Tổng case" value={cases.length} />
        <SummaryCard label="Đang mở" value={openCount} tone="rose" />
        <SummaryCard label="Chưa có trên MISA" value={missingCount} tone="amber" />
        <SummaryCard label="Có thể gửi lại" value={retryableCaseIds.length} tone="emerald" />
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        <p className="font-bold">Quy tắc chống gửi trùng</p>
        <p className="mt-1">Nút “Gửi lại” chỉ xuất hiện khi MISA đã từ chối lần gửi trước. Trước khi đưa vào hàng đợi, hệ thống kiểm tra trực tiếp RefID và sẽ chặn nếu MISA đã có dấu vết phát hành.</p>
      </section>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold underline">Ẩn</button>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã đơn, khách hàng, RefID, TransactionID…"
              className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-sky-500"
            />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold">
            <option value="OPEN">Case đang mở</option>
            <option value="RESOLVED">Case đã đóng</option>
            <option value="ALL">Tất cả trạng thái</option>
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="h-10 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold">
            <option value="ALL">Tất cả loại sai lệch</option>
            {Object.values(InvoiceReconciliationCaseType).map((type) => <option key={type} value={type}>{casePresentation[type].title}</option>)}
          </select>
          <button
            type="button"
            onClick={() => startRetry(selectedRetryableIds)}
            disabled={!canRetry || selectedRetryableIds.length === 0 || retrying}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            <Send size={14} /> Gửi lại đã chọn ({selectedRetryableIds.length})
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Danh sách sai lệch</h2>
            <p className="text-xs text-slate-500">{filteredCases.length} kết quả · Trang {visiblePage}/{pageCount}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-45">
            <RefreshCw className={loading ? "animate-spin" : ""} size={13} /> Làm mới
          </button>
        </div>
        {loading ? (
          <div className="grid gap-2 p-3 animate-pulse">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 rounded-lg bg-slate-100" />)}</div>
        ) : paginatedCases.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Không có case phù hợp với bộ lọc.</div>
        ) : (
          <div className="grid gap-2 p-3">
            {paginatedCases.map((item) => {
              const source = item.source_order_document_id ? ledgerBySourceId.get(item.source_order_document_id) : null;
              const retryCandidate = retryCandidateForCase(item);
              const isSelected = selectedCaseIds.includes(item.id);
              const presentation = casePresentation[item.type];
              return (
                <article key={item.id} className="rounded-lg border border-slate-200 p-3 shadow-xs">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!retryCandidate}
                        aria-label={`Chọn case ${source?.order_number ?? item.id}`}
                        onChange={() => setSelectedCaseIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 disabled:opacity-30"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${presentation.tone}`}>{presentation.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.status === InvoiceReconciliationCaseStatus.OPEN ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{item.status === InvoiceReconciliationCaseStatus.OPEN ? "Đang mở" : "Đã đóng"}</span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-slate-950">Đơn: {source?.order_number ?? source?.source_order_id ?? item.source_order_document_id ?? "Không xác định"}</h3>
                        <p className="mt-0.5 text-xs text-slate-600">{presentation.description}</p>
                        <div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                          <Info label="Khách hàng" value={source?.customer_name ?? "Khách lẻ / chưa xác định"} />
                          <Info label="Tổng tiền" value={source?.total_amount == null ? "—" : money.format(source.total_amount)} />
                          <Info label="Trạng thái xử lý" value={source?.invoice_document_status ? documentStatusLabel[source.invoice_document_status] ?? source.invoice_document_status : item.invoice_document_id ? "Đã tạo draft" : "Chưa từng gửi MISA"} />
                          <Info label="Phát hiện gần nhất" value={formatDateTime(item.last_seen_at)} />
                          <Info label="RefID MISA" value={item.misa_ref_id ?? source?.ref_id ?? "Chưa có"} mono />
                          <Info label="TransactionID" value={item.misa_transaction_id ?? source?.transaction_id ?? "Chưa có"} mono />
                          <Info label="Mã lỗi MISA" value={retryCandidate?.misa_error_code ?? String(item.details?.error_code ?? item.details?.publish_status ?? "Không có mã lỗi")} />
                          <Info label="ID chứng từ" value={item.invoice_document_id ?? "Chưa có"} mono />
                        </div>
                        {retryCandidate && <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800"><span className="font-bold">Có thể gửi lại:</span> {retryCandidate.message}</div>}
                        {item.resolution_note && <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700"><span className="font-bold">Kết quả xử lý:</span> {item.resolution_note}</div>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 lg:w-44 lg:flex-col">
                      {retryCandidate && (
                        <button type="button" onClick={() => startRetry([item.id])} disabled={!canRetry || retrying} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40">
                          <Send size={14} /> Gửi lại hóa đơn
                        </button>
                      )}
                      {item.status === InvoiceReconciliationCaseStatus.OPEN && (
                        <button type="button" onClick={() => { setResolvingCase(item); setResolutionNote(""); }} disabled={!canReconcile} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                          <CheckCircle2 size={14} /> Đóng case
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5">
          <span className="text-xs text-slate-500">Hiển thị tối đa {PAGE_SIZE} case mỗi trang</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setPage(Math.max(1, visiblePage - 1))} disabled={visiblePage <= 1} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold disabled:opacity-35"><ChevronLeft size={13} /> Trước</button>
            <button type="button" onClick={() => setPage(Math.min(pageCount, visiblePage + 1))} disabled={visiblePage >= pageCount} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold disabled:opacity-35">Sau <ChevronRight size={13} /></button>
          </div>
        </div>
      </section>

      {retryCaseIds.length > 0 && (
        <ActionOtpModal
          title="Xác nhận gửi lại hóa đơn"
          description={`Hệ thống sẽ kiểm tra lại MISA trước khi gửi ${retryCaseIds.length} hóa đơn để tránh phát hành trùng.`}
          isSubmitting={retrying}
          onConfirm={(otp) => void submitRetry(otp)}
          onCancel={() => !retrying && setRetryCaseIds([])}
        />
      )}

      {resolvingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div>
                <h3 className="text-sm font-bold text-slate-950">Đóng case, không gửi lại hóa đơn</h3>
                <p className="mt-1 text-xs text-slate-600">Chỉ đóng sau khi đã xác minh và ghi rõ kết quả. Thao tác này không gọi MISA.</p>
              </div>
            </div>
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Ví dụ: Đã kiểm tra hóa đơn trên MISA, số HĐ 000123…"
              className="mt-4 h-28 w-full rounded-md border border-slate-200 p-2.5 text-xs outline-none focus:border-sky-500"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setResolvingCase(null); setResolutionNote(""); }} disabled={resolving} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold">Hủy</button>
              <button type="button" onClick={() => void submitResolve()} disabled={resolutionNote.trim().length < 3 || resolving} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-40">
                {resolving ? <LoaderCircle className="animate-spin" size={13} /> : <CheckCircle2 size={13} />} Xác nhận đóng case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "rose" | "amber" | "emerald" }) {
  const styles = {
    slate: "border-slate-200 bg-white text-slate-900",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-xl border p-3 ${styles[tone]}`}><div className="text-lg font-black tabular-nums">{value}</div><div className="text-xs font-semibold opacity-75">{label}</div></div>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><span className="font-semibold text-slate-500">{label}: </span><span title={value} className={`${mono ? "font-mono text-[11px]" : "font-semibold"} break-all text-slate-800`}>{value}</span></div>;
}
