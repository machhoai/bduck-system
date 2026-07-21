"use client";

import { LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoiceApi, type MisaInvoiceListResult } from "@/api/invoiceApi";
import { shortName } from "@/utils/name";

const amount = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const invoiceStatus = (invoice: MisaInvoiceListResult["invoices"][number]) => {
  if (invoice.is_deleted) return "Đã xóa/hủy";
  if (invoice.publish_status === 1) return "Đã phát hành";
  return invoice.publish_status === null
    ? "Chưa xác định"
    : `Trạng thái ${invoice.publish_status}`;
};

export function MisaInvoicePanel({
  warehouseId,
  businessDate,
  refreshToken,
}: {
  warehouseId: string;
  businessDate: string;
  refreshToken: string;
}) {
  const [result, setResult] = useState<MisaInvoiceListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState("ALL");

  const load = useCallback(async () => {
    if (!warehouseId || !businessDate) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await invoiceApi.listMisaInvoices(warehouseId, businessDate));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Không thể tải hóa đơn MISA.",
      );
    } finally {
      setLoading(false);
    }
  }, [businessDate, warehouseId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const invoices = result?.invoices ?? [];
  const seriesValues = useMemo(
    () =>
      [
        ...new Set(
          invoices.map((invoice) => invoice.inv_series).filter(Boolean),
        ),
      ].sort() as string[],
    [invoices],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return invoices.filter((invoice) => {
      if (series !== "ALL" && invoice.inv_series !== series) return false;
      if (!normalizedQuery) return true;
      return [
        invoice.invoice_number,
        invoice.inv_series,
        invoice.buyer_name,
        invoice.buyer_tax_code,
        invoice.buyer_order_code,
        invoice.transaction_id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("vi").includes(normalizedQuery),
        );
    });
  }, [invoices, query, series]);

  return (
    <div className="grid gap-3">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["MISA trả về", invoices.length],
          [
            "Đã phát hành",
            invoices.filter(
              (item) => item.publish_status === 1 && !item.is_deleted,
            ).length,
          ],
          [
            "Có mã đơn",
            invoices.filter((item) => Boolean(item.buyer_order_code)).length,
          ],
          ["Đã xóa/hủy", invoices.filter((item) => item.is_deleted).length],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-white p-2 flex flex-col justify-center"
          >
            <div className="text-sm font-bold text-slate-900">{value}</div>
            <div className="text-xxs text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-2.5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Toàn bộ hóa đơn MISA</h2>
            <p className="text-xxs text-slate-500">
              {businessDate}
              {result?.fetched_at
                ? ` · cập nhật ${new Date(result.fetched_at).toLocaleString("vi-VN")}`
                : " · chưa có lần đối chiếu"}
            </p>
          </div>
          <div className="relative min-w-0 flex-1 lg:max-w-[100px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={13}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm số hóa đơn, người mua, MST, mã đơn…"
              className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2.5 text-xs outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={series}
            onChange={(event) => setSeries(event.target.value)}
            className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-semibold outline-none"
          >
            <option value="ALL">Tất cả ký hiệu</option>
            {seriesValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="p-3 space-y-2 animate-pulse" aria-label="Đang tải hóa đơn MISA…">
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
        ) : filtered.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center px-6 text-center text-xs text-slate-500">
            Chưa có hóa đơn MISA cho ngày này. Hãy chọn mục đích Đối chiếu và
            đồng bộ toàn ngày.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 p-3">
            {filtered.map((invoice) => (
              <div
                key={invoice.id}
                className="group relative rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:border-emerald-300 hover:shadow-md transition-all duration-150"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {invoice.invoice_number ?? "—"}
                      </span>
                      {invoice.inv_series && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          Ký hiệu: {invoice.inv_series}
                        </span>
                      )}
                      {invoice.invoice_date && (
                        <span className="text-xs text-slate-500 font-medium">
                          • {invoice.invoice_date}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-900" title={invoice.buyer_name || "Khách lẻ"}>
                          {shortName(invoice.buyer_name) || "Khách lẻ"}
                        </span>
                        {invoice.buyer_tax_code && (
                          <span className="ml-1.5 text-slate-400">
                            (MST: {invoice.buyer_tax_code})
                          </span>
                        )}
                      </div>
                      {invoice.buyer_order_code && (
                        <div className="text-slate-500">
                          Đơn: <span className="font-medium text-slate-700">{invoice.buyer_order_code}</span>
                        </div>
                      )}
                      {invoice.payment_method_name && (
                        <div className="text-slate-400">
                          {invoice.payment_method_name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex flex-col text-right">
                      <span className="text-[11px] text-emerald-800 uppercase tracking-wider font-bold">Tổng tiền</span>
                      <span className="text-sm sm:text-base font-bold tabular-nums text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/80 shadow-2xs">
                        {amount.format(invoice.total_amount ?? 0)}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          invoice.is_deleted
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : invoice.publish_status === 1
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {invoiceStatus(invoice)}
                      </span>
                      {invoice.send_tax_status !== null && (
                        <span className="text-xs text-slate-400">
                          Thuế: {invoice.send_tax_status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
