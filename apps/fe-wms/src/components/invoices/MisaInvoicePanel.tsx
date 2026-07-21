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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xxs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-2 py-1.5">Số hóa đơn</th>
                  <th className="px-2 py-1.5">Ngày hóa đơn</th>
                  <th className="px-2 py-1.5">Người mua</th>
                  <th className="px-2 py-1.5">Mã đơn</th>
                  <th className="px-2 py-1.5">Thanh toán</th>
                  <th className="px-2 py-1.5 text-right">Tổng tiền</th>
                  <th className="px-2 py-1.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70 text-xs">
                    <td className="px-2 py-1.5">
                      <div className="font-semibold text-slate-900 text-xs">
                        {invoice.invoice_number ?? "—"}
                      </div>
                      <div className="text-xxs text-slate-500">
                        {invoice.inv_series ?? "—"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 text-xxs">
                      {invoice.invoice_date ?? "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="max-w-64 truncate font-medium text-slate-900 text-xs" title={invoice.buyer_name || "Khách lẻ"}>
                        {shortName(invoice.buyer_name) || "Khách lẻ"}
                      </div>
                      <div className="text-xxs text-slate-500">
                        {invoice.buyer_tax_code || "Không có MST"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="max-w-52 truncate text-xs">
                        {invoice.buyer_order_code || "Chưa có mã liên kết"}
                      </div>
                      <div
                        className="max-w-52 truncate text-xxs text-slate-400"
                        title={invoice.transaction_id ?? undefined}
                      >
                        {invoice.transaction_id ?? "—"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 text-xxs">
                      {invoice.payment_method_name ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-900 text-xs">
                      {amount.format(invoice.total_amount ?? 0)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xxs font-semibold ${invoice.is_deleted ? "bg-rose-50 text-rose-700" : invoice.publish_status === 1 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {invoiceStatus(invoice)}
                      </span>
                      {invoice.send_tax_status !== null && (
                        <div className="mt-0.5 text-micro text-slate-400">
                          Thuế: {invoice.send_tax_status}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
