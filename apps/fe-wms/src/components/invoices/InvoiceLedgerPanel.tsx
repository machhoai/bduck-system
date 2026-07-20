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

  const resolveCase = async (item: InvoiceReconciliationCaseView) => {
    const note = window.prompt("Nhập lý do/kết quả xử lý case đối chiếu:");
    if (!note || note.trim().length < 3) return;
    setWorkingId(item.id);
    try {
      await invoiceApi.resolveReconciliationCase(item.id, warehouseId, note.trim());
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể đóng case đối chiếu.");
    } finally { setWorkingId(null); }
  };

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {mode === "RECONCILIATION" && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Đơn nguồn", ledger.length],
            ["Đã khớp MISA", ledger.filter((item) => item.match_status === InvoiceOrderMatchStatus.MATCHED).length],
            ["Chưa xuất", ledger.filter((item) => item.match_status === InvoiceOrderMatchStatus.NOT_ISSUED).length],
            ["Case đang mở", openCases.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-3">
          <div>
            <h2 className="font-bold text-slate-900">{mode === "ISSUED" ? "Hóa đơn đã phát hành" : "Sổ đối chiếu theo ngày"}</h2>
            <p className="text-xs text-slate-500">JoyWorld ↔ MISA meInvoice · {businessDate}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={17} /> Đang tải…</div>
        ) : visibleLedger.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">Chưa có dữ liệu phù hợp. Hãy đồng bộ ngày đã chọn.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-3">Đơn hàng</th><th className="px-4 py-3">Hóa đơn MISA</th>
                <th className="px-4 py-3">Ngày hóa đơn</th><th className="px-4 py-3">Tổng tiền</th>
                <th className="px-4 py-3">Đối chiếu</th><th className="px-4 py-3 text-right">Tệp</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{visibleLedger.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.order_number ?? item.source_order_id}</div><div className="text-xs text-slate-500">{item.customer_name || "Khách lẻ"}</div></td>
                  <td className="px-4 py-3"><div className="font-semibold">{item.invoice_number ?? "—"}</div><div className="text-xs text-slate-500">{item.inv_series ?? "—"}</div></td>
                  <td className="px-4 py-3 text-slate-600">{item.invoice_date ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{amount.format(item.total_amount ?? 0)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.match_status === InvoiceOrderMatchStatus.MATCHED ? "bg-emerald-50 text-emerald-700" : item.match_status === InvoiceOrderMatchStatus.NOT_ISSUED ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.match_status}</span>{item.reconciliation_case_count > 0 && <span className="ml-2 text-xs font-semibold text-rose-600">{item.reconciliation_case_count} case</span>}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                    <ActionButton label="Xem" disabled={!canDownload || !item.transaction_id} loading={workingId === `${item.id}:view`} onClick={() => void handleView(item)} icon={<ExternalLink size={14} />} />
                    <ActionButton label="PDF" disabled={!canDownload || !item.transaction_id} loading={workingId === `${item.id}:Pdf`} onClick={() => void handleDownload(item, "Pdf")} icon={<FileDown size={14} />} />
                    <ActionButton label="XML" disabled={!canDownload || !item.transaction_id} loading={workingId === `${item.id}:Xml`} onClick={() => void handleDownload(item, "Xml")} icon={<FileDown size={14} />} />
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {mode === "RECONCILIATION" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3"><h2 className="font-bold text-slate-900">Case sai lệch</h2><p className="text-xs text-slate-500">Chỉ đóng case sau khi đã ghi rõ kết quả kiểm tra.</p></div>
          {cases.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">Không có case sai lệch.</div> : <div className="divide-y divide-slate-100">{cases.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <FileSearch size={17} className="shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{item.type}</div><div className="truncate text-xs text-slate-500">Đơn: {item.source_order_document_id ?? "không xác định"} · MISA: {item.misa_transaction_id ?? item.misa_ref_id ?? "không xác định"}</div>{item.resolution_note && <div className="mt-1 text-xs text-emerald-700">Kết quả: {item.resolution_note}</div>}</div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === InvoiceReconciliationCaseStatus.OPEN ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{item.status}</span>
              {item.status === InvoiceReconciliationCaseStatus.OPEN && <button type="button" disabled={!canResolve || workingId === item.id} onClick={() => void resolveCase(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Đánh dấu đã xử lý</button>}
            </div>
          ))}</div>}
        </section>
      )}
    </div>
  );
}

function ActionButton({ label, disabled, loading, onClick, icon }: { label: string; disabled: boolean; loading: boolean; onClick: () => void; icon: React.ReactNode }) {
  return <button type="button" title={label} disabled={disabled || loading} onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">{loading ? <LoaderCircle size={14} className="animate-spin" /> : icon}{label}</button>;
}
