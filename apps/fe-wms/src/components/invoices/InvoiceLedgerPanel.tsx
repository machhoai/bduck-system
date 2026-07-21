"use client";

import {
  ExternalLink,
  FileDown,
  FileSearch,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  InvoiceOrderMatchStatus,
  InvoiceReconciliationCaseStatus,
} from "@bduck/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  invoiceApi,
  type InvoiceLedgerEntryView,
  type InvoiceReconciliationCaseView,
} from "@/api/invoiceApi";
import { shortName } from "@/utils/name";

const amount = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const saveInvoiceData = (result: Awaited<ReturnType<typeof invoiceApi.downloadPublishedInvoice>>) => {
  if (result.isUrl) {
    window.open(result.data, "_blank", "noopener,noreferrer");
    return;
  }
  const mime = result.type === "Pdf" ? "application/pdf" : "application/xml;charset=utf-8";
  let blob: Blob;
  if (result.type === "Xml" && result.data.trimStart().startsWith("<")) {
    blob = new Blob([result.data], { type: mime });
  } else {
    const decoded = window.atob(result.data.replace(/\s/g, ""));
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    blob = new Blob([bytes], { type: mime });
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `invoice-${result.transactionId}.${result.type.toLowerCase()}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export function InvoiceLedgerPanel({
  warehouseId,
  businessDate,
  mode,
  refreshToken,
  canDownload,
  canResolve,
}: {
  warehouseId: string;
  businessDate: string;
  mode: "ISSUED" | "RECONCILIATION";
  refreshToken: string;
  canDownload: boolean;
  canResolve: boolean;
}) {
  const [ledger, setLedger] = useState<InvoiceLedgerEntryView[]>([]);
  const [cases, setCases] = useState<InvoiceReconciliationCaseView[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvingCase, setResolvingCase] = useState<InvoiceReconciliationCaseView | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!warehouseId || !businessDate) return;
    setLoading(true);
    setError(null);
    try {
      const [nextLedger, nextCases] = await Promise.all([
        invoiceApi.listLedger(warehouseId, businessDate),
        mode === "RECONCILIATION"
          ? invoiceApi.listReconciliationCases(warehouseId, businessDate)
          : Promise.resolve([]),
      ]);
      setLedger(nextLedger);
      setCases(nextCases);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể tải sổ hóa đơn.");
    } finally {
      setLoading(false);
    }
  }, [businessDate, mode, warehouseId]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const visibleLedger = useMemo(() => mode === "ISSUED"
    ? ledger.filter((item) => item.match_status === InvoiceOrderMatchStatus.MATCHED || Boolean(item.transaction_id))
    : ledger, [ledger, mode]);
  const openCases = cases.filter((item) => item.status === InvoiceReconciliationCaseStatus.OPEN);

  const handleView = async (item: InvoiceLedgerEntryView) => {
    setWorkingId(`${item.id}:view`);
    setError(null);
    try {
      const result = await invoiceApi.viewPublishedInvoice(item.id, warehouseId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể xem hóa đơn.");
    } finally { setWorkingId(null); }
  };

  const handleDownload = async (item: InvoiceLedgerEntryView, type: "Pdf" | "Xml") => {
    setWorkingId(`${item.id}:${type}`);
    setError(null);
    try {
      saveInvoiceData(await invoiceApi.downloadPublishedInvoice(item.id, warehouseId, type));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể tải hóa đơn.");
    } finally { setWorkingId(null); }
  };

  const resolveCase = (item: InvoiceReconciliationCaseView) => {
    setResolvingCase(item);
    setNote("");
  };

  const submitResolveCase = async () => {
    if (!resolvingCase || note.trim().length < 3) return;
    const item = resolvingCase;
    setWorkingId(item.id);
    setResolvingCase(null);
    try {
      await invoiceApi.resolveReconciliationCase(item.id, warehouseId, note.trim());
      setNote("");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể đóng case đối chiếu.");
    } finally { setWorkingId(null); }
  };

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {mode === "RECONCILIATION" && (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["Đơn nguồn", ledger.length],
            ["Đã khớp MISA", ledger.filter((item) => item.match_status === InvoiceOrderMatchStatus.MATCHED).length],
            ["Chưa xuất", ledger.filter((item) => item.match_status === InvoiceOrderMatchStatus.NOT_ISSUED).length],
            ["Case đang mở", openCases.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-2 flex flex-col justify-center">
              <div className="text-sm font-bold text-slate-900">{value}</div>
              <div className="text-xxs text-slate-500">{label}</div>
            </div>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-2.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{mode === "ISSUED" ? "Hóa đơn đã phát hành" : "Sổ đối chiếu theo ngày"}</h2>
            <p className="text-xxs text-slate-500">JoyWorld ↔ MISA meInvoice · {businessDate}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
        {loading ? (
          <div className="p-3 space-y-2 animate-pulse" aria-label="Đang tải…">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex h-10 items-center gap-4 rounded-md bg-slate-50 px-3">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="ml-auto h-4 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : visibleLedger.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center text-xs text-slate-500">Chưa có dữ liệu phù hợp. Hãy đồng bộ ngày đã chọn.</div>
        ) : (
          <div className="flex flex-col gap-2.5 p-3">
            {visibleLedger.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:border-indigo-300 hover:shadow-md transition-all duration-150"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        Đơn: {item.order_number ?? item.source_order_id}
                      </span>
                      {item.invoice_number && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          HĐ MISA: {item.invoice_number} ({item.inv_series ?? "—"})
                        </span>
                      )}
                      {item.invoice_date && (
                        <span className="text-xs text-slate-500 font-medium">
                          • {item.invoice_date}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <div>
                        Khách hàng: <span className="font-semibold text-slate-900" title={item.customer_name || "Khách lẻ"}>
                          {shortName(item.customer_name) || "Khách lẻ"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="flex flex-col text-right">
                      <span className="text-[11px] text-indigo-800 uppercase tracking-wider font-bold">Tổng tiền</span>
                      <span className="text-sm sm:text-base font-bold tabular-nums text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200/80 shadow-2xs">
                        {amount.format(item.total_amount ?? 0)}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.match_status === InvoiceOrderMatchStatus.MATCHED
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : item.match_status === InvoiceOrderMatchStatus.NOT_ISSUED
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {item.match_status}
                      </span>
                      {item.reconciliation_case_count > 0 && (
                        <span className="text-xs font-semibold text-rose-600">
                          {item.reconciliation_case_count} case
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <ActionButton
                        label="Xem"
                        disabled={!canDownload || !item.transaction_id}
                        loading={workingId === `${item.id}:view`}
                        onClick={() => void handleView(item)}
                        icon={<ExternalLink size={13} />}
                      />
                      <ActionButton
                        label="PDF"
                        disabled={!canDownload || !item.transaction_id}
                        loading={workingId === `${item.id}:Pdf`}
                        onClick={() => void handleDownload(item, "Pdf")}
                        icon={<FileDown size={13} />}
                      />
                      <ActionButton
                        label="XML"
                        disabled={!canDownload || !item.transaction_id}
                        loading={workingId === `${item.id}:Xml`}
                        onClick={() => void handleDownload(item, "Xml")}
                        icon={<FileDown size={13} />}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {mode === "RECONCILIATION" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-2.5">
            <h2 className="text-sm font-bold text-slate-900">Case sai lệch</h2>
            <p className="text-xs text-slate-500">Chỉ đóng case sau khi đã ghi rõ kết quả kiểm tra.</p>
          </div>
          {cases.length === 0 ? <div className="p-6 text-center text-xs text-slate-500">Không có case sai lệch.</div> : <div className="divide-y divide-slate-100">{cases.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center text-xs">
              <FileSearch size={15} className="shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 text-xs">{item.type}</div>
                <div className="truncate text-xs text-slate-500">Đơn: {item.source_order_document_id ?? "không xác định"} · MISA: {item.misa_transaction_id ?? item.misa_ref_id ?? "không xác định"}</div>
                {item.resolution_note && <div className="mt-0.5 text-xs text-emerald-700">Kết quả: {item.resolution_note}</div>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === InvoiceReconciliationCaseStatus.OPEN ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{item.status}</span>
              {item.status === InvoiceReconciliationCaseStatus.OPEN && <button type="button" disabled={!canResolve || workingId === item.id} onClick={() => resolveCase(item)} className="h-7 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold disabled:opacity-50 hover:bg-slate-50">Đánh dấu đã xử lý</button>}
            </div>
          ))}</div>}
        </section>
      )}

      {resolvingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-[400px] rounded-lg bg-white p-3.5 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Xử lý case đối chiếu</h3>
            <p className="mt-1 text-xs text-slate-500">
              Nhập ghi chú xử lý để quản trị viên và đối soát dễ dàng truy vết.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Đã phát hành bổ sung hóa đơn trên MISA web, số HĐ: 000123"
              className="mt-3.5 h-24 w-full rounded-md border border-slate-200 p-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <div className="mt-3.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResolvingCase(null);
                  setNote("");
                }}
                className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={note.trim().length < 3}
                onClick={() => void submitResolveCase()}
                className="h-8 rounded-md bg-sky-700 px-3 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-40"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, disabled, loading, onClick, icon }: { label: string; disabled: boolean; loading: boolean; onClick: () => void; icon: React.ReactNode }) {
  return <button type="button" title={label} disabled={disabled || loading} onClick={onClick} className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors">{loading ? <LoaderCircle size={13} className="animate-spin" /> : icon}{label}</button>;
}
