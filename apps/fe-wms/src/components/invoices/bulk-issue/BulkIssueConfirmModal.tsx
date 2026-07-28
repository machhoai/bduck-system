"use client";

import { AlertTriangle, ChevronDown, PackageCheck, X } from "lucide-react";
import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const quantity = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

function SummaryCard({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        strong ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xxs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold tabular-nums ${
          strong ? "text-sky-800" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
export function BulkIssueConfirmModal({
  preview,
  lang,
  onCancel,
  onConfirm,
}: {
  preview: InvoiceBulkIssuePreview;
  lang: "vi" | "zh";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const summary = preview.summary;
  const vi = lang === "vi";

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={vi ? "Xác nhận xuất hóa đơn" : "确认批量开票"}
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:max-w-5xl sm:rounded-2xl animate-in slide-in-from-bottom-5 duration-200">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 pt-3 pb-4">
          <div className="flex-1">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            <p className="text-micro font-bold uppercase tracking-wider text-sky-700">
              MISA meInvoice
            </p>
            <h3 className="mt-0.5 text-base font-bold text-slate-950">
              {vi ? "Kiểm tra danh sách trước khi xuất" : "开票前核对列表"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {preview.business_date} ·{" "}
              {preview.selection_mode === "ALL"
                ? vi
                  ? "Tất cả đơn trong ngày"
                  : "当日全部订单"
                : vi
                  ? "Các đơn đã chọn"
                  : "已选订单"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label={vi ? "Đóng" : "关闭"}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <SummaryCard
              label={vi ? "Số lượng hóa đơn" : "发票数量"}
              value={summary.eligible_count}
              strong
            />
            <SummaryCard
              label={vi ? "Tiền trước thuế" : "税前金额"}
              value={money.format(summary.total_amount_without_vat)}
            />
            <SummaryCard
              label={vi ? "Tổng VAT" : "增值税合计"}
              value={money.format(summary.total_vat_amount)}
            />
            <SummaryCard
              label={vi ? "Tiền sau thuế" : "税后总额"}
              value={money.format(summary.total_amount)}
              strong
            />
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <PackageCheck className="text-sky-700" size={16} />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {vi
                    ? "Tổng số lượng theo sản phẩm đã đổi tên"
                    : "按重命名商品汇总数量"}
                </h4>
                <p className="text-xxs text-slate-500">
                  {summary.product_line_count}{" "}
                  {vi ? "dòng sản phẩm" : "个商品行"} ·{" "}
                  {quantity.format(summary.product_quantity)}{" "}
                  {vi ? "sản phẩm" : "件商品"}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-xxs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      {vi ? "Sản phẩm" : "商品"}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {vi ? "Đơn vị" : "单位"}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {vi ? "Số lượng" : "数量"}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {vi ? "Hóa đơn" : "发票"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.product_summary.map((product) => (
                    <tr key={`${product.item_name}-${product.unit_name ?? ""}`}>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {product.item_name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {product.unit_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                        {quantity.format(product.quantity)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {product.invoice_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold text-slate-900">
              {vi ? "Danh sách hóa đơn xác nhận" : "待确认发票列表"} (
              {preview.invoices.length})
            </h4>
            <div className="grid gap-2">
              {preview.invoices.map((invoice, index) => (
                <details
                  key={invoice.source_order_document_id}
                  className="group rounded-lg border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xxs font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {invoice.order_number ?? invoice.source_order_id}
                      </p>
                      <p className="mt-0.5 text-xxs text-slate-500">
                        {invoice.payment_time} · {invoice.products.length}{" "}
                        {vi ? "sản phẩm" : "个商品"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold tabular-nums text-sky-800">
                        {money.format(invoice.total_amount)}
                      </p>
                      <p className="text-xxs text-slate-500">
                        VAT {money.format(invoice.total_vat_amount)}
                      </p>
                    </div>
                    <ChevronDown
                      className="shrink-0 text-slate-400 transition group-open:rotate-180"
                      size={16}
                    />
                  </summary>
                  <div className="border-t border-slate-100 px-3 py-2">
                    {invoice.products.map((product) => (
                      <div
                        key={`${product.item_name}-${product.unit_name ?? ""}`}
                        className="flex items-center justify-between gap-3 py-1 text-xs"
                      >
                        <span className="min-w-0 truncate text-slate-700">
                          {product.item_name}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                          {quantity.format(product.quantity)}{" "}
                          {product.unit_name ?? ""}
                        </span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-end gap-3 border-t border-slate-100 pt-2 text-xxs text-slate-500">
                      <span>
                        {vi ? "Trước thuế" : "税前"}{" "}
                        {money.format(invoice.total_amount_without_vat)}
                      </span>
                      <span>VAT {money.format(invoice.total_vat_amount)}</span>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {summary.excluded_count > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>
                {summary.excluded_count}{" "}
                {vi
                  ? "đơn không đủ điều kiện sẽ được bỏ qua. Kiểm tra go-live và chống xuất trùng vẫn được giữ."
                  : "个不符合条件的订单将被跳过，启用时间和防重复检查仍然有效。"}
              </span>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 w-full sm:w-auto rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            {vi ? "Quay lại" : "返回"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 w-full sm:w-auto rounded-lg bg-sky-700 px-4 text-xs font-bold text-white hover:bg-sky-800 active:scale-[0.98] transition-all"
          >
            {vi ? "Xác nhận và tiếp tục OTP" : "确认并继续 OTP"}
          </button>
        </footer>
      </div>
    </div>
  );
}
