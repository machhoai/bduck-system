"use client";

import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";
import {
  AlertTriangle,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  LoaderCircle,
  PackageCheck,
  X,
} from "lucide-react";
import { useState } from "react";

import { useBulkIssueMisaPreview } from "@/hooks/useBulkIssueMisaPreview";
import { downloadInvoiceBulkIssueExcel } from "@/utils/invoiceBulkIssueExcel";
import { showToast } from "@/utils/toast";

import { bulkIssueReason, isChangedSourceIssue } from "./bulkIssueIssueReason";
import { summarizeBulkIssuePayments } from "./bulkIssuePaymentSummary";
import { BulkIssueSummaryCard } from "./BulkIssueSummaryCard";
import { bulkIssueTranslations } from "./bulkIssueTranslations";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const quantity = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

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
  const d = bulkIssueTranslations[lang];
  const paymentSummaries = summarizeBulkIssuePayments(
    preview.invoices,
    d.unspecifiedPaymentMethod,
  );
  const sourceChanged = preview.excluded.some((invoice) =>
    invoice.issue_codes.some(isChangedSourceIssue),
  );
  const abnormalAmount = preview.invoices.some(
    (invoice) =>
      invoice.total_amount <= 0 ||
      invoice.total_amount_without_vat < 0 ||
      invoice.total_vat_amount < 0 ||
      Math.abs(
        invoice.total_amount_without_vat +
          invoice.total_vat_amount -
          invoice.total_amount,
      ) > 1,
  );
  const [exportingExcel, setExportingExcel] = useState(false);
  const { previewingInvoiceId, previewInvoice } = useBulkIssueMisaPreview(
    preview,
    lang,
  );

  const handleExportExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      await showToast.promise(downloadInvoiceBulkIssueExcel(preview), {
        loading: d.exportingExcel,
        success: d.exportExcelSuccess,
        error: d.exportExcelError,
        successDescription: d.exportExcelSuccessDescription,
        errorDescription: d.exportExcelErrorDescription,
      });
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={d.confirmModalTitle}
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:max-w-5xl sm:rounded-2xl animate-in slide-in-from-bottom-5 duration-200">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 pt-3 pb-4">
          <div className="flex-1">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            <p className="text-micro font-bold uppercase tracking-wider text-sky-700">
              MISA meInvoice
            </p>
            <h3 className="mt-0.5 text-base font-bold text-slate-950">
              {d.confirmModalSubtitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {preview.business_date} ·{" "}
              {preview.selection_mode === "ALL"
                ? d.allOrdersToday
                : d.selectedOrders}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label={d.close}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <BulkIssueSummaryCard
              label={d.invoiceCount}
              value={summary.eligible_count}
              strong
            />
            <BulkIssueSummaryCard
              label={d.amountBeforeTax}
              value={money.format(summary.total_amount_without_vat)}
            />
            <BulkIssueSummaryCard
              label={d.totalVat}
              value={money.format(summary.total_vat_amount)}
            />
            <BulkIssueSummaryCard
              label={d.amountAfterTax}
              value={money.format(summary.total_amount)}
              strong
            />
          </section>

          <section className="grid grid-cols-1 gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 min-[360px]:grid-cols-2">
            {paymentSummaries.map((payment) => (
              <div
                key={payment.paymentMethodName}
                className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"
              >
                <p className="truncate text-xxs font-semibold text-emerald-800">
                  {payment.paymentMethodName}
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                  {money.format(payment.totalAmount)}
                </p>
                <p className="mt-0.5 text-xxs text-slate-500">
                  {d.paymentInvoiceCount(payment.invoiceCount)}
                </p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <PackageCheck className="text-sky-700" size={16} />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {d.productSummaryTitle}
                </h4>
                <p className="text-xxs text-slate-500">
                  {d.productSummarySubtitle(
                    summary.product_line_count,
                    quantity.format(summary.product_quantity),
                  )}
                </p>
              </div>
            </div>
            <div className="grid gap-2 p-2 sm:hidden">
              {preview.product_summary.map((product) => (
                <div
                  key={`${product.item_name}-${product.unit_name ?? ""}`}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">
                    {product.item_name}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xxs text-slate-600">
                    <span>{product.unit_name ?? "—"}</span>
                    <span className="font-bold tabular-nums text-slate-900">
                      {quantity.format(product.quantity)} ·{" "}
                      {product.invoice_count}{" "}
                      {d.invoicesCol.toLocaleLowerCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-xxs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{d.productCol}</th>
                    <th className="px-3 py-2 font-semibold">{d.unitCol}</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {d.quantityCol}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {d.invoicesCol}
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
              {d.invoiceListTitle(preview.invoices.length)}
            </h4>
            <div className="grid gap-2">
              {preview.invoices.map((invoice, index) => (
                <details
                  key={invoice.source_order_document_id}
                  className="group rounded-lg border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 sm:flex-nowrap sm:gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xxs font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {invoice.order_number ?? invoice.source_order_id}
                      </p>
                      <p className="mt-0.5 text-xxs text-slate-500">
                        {invoice.payment_time} ·{" "}
                        {d.productsCount(invoice.products.length)}
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
                    <button
                      type="button"
                      disabled={previewingInvoiceId !== null}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void previewInvoice(invoice);
                      }}
                      className="order-last ml-9 inline-flex h-9 w-[calc(100%-2.25rem)] shrink-0 items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 text-xxs font-bold text-sky-800 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-50 sm:order-none sm:ml-0 sm:h-8 sm:w-auto"
                    >
                      {previewingInvoiceId ===
                      invoice.source_order_document_id ? (
                        <LoaderCircle className="animate-spin" size={13} />
                      ) : (
                        <Eye size={13} />
                      )}
                      {previewingInvoiceId === invoice.source_order_document_id
                        ? d.generatingPreview
                        : d.misaPreviewBtn}
                    </button>
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
                        {d.beforeTaxShort}{" "}
                        {money.format(invoice.total_amount_without_vat)}
                      </span>
                      <span>VAT {money.format(invoice.total_vat_amount)}</span>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {summary.total_vat_amount === 0 && (
            <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>
                {lang === "vi"
                  ? "Cảnh báo: tổng tiền thuế đang bằng 0. Hãy mở xem trước từng hóa đơn và xác nhận cấu hình thuế trước khi nhập OTP."
                  : "Warning: total VAT is zero. Preview invoices and verify tax configuration before entering OTP."}
              </span>
            </div>
          )}

          {abnormalAmount && (
            <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>
                {lang === "vi"
                  ? "Cảnh báo: có hóa đơn có tổng tiền không hợp lệ hoặc tiền trước thuế cộng tiền thuế không khớp tổng thanh toán. Hãy mở xem trước hóa đơn và nhờ IT kiểm tra nếu số tiền nguồn là đúng."
                  : "Warning: an invoice has an invalid total or its pre-tax amount plus VAT does not match the payable total. Preview it and contact IT if the source amount is correct."}
              </span>
            </div>
          )}

          {sourceChanged && (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>
                {lang === "vi"
                  ? "Dữ liệu đơn hàng vừa thay đổi nên các hóa đơn liên quan đã bị loại khỏi lần phát hành này. Hãy bấm Cập nhật dữ liệu và kiểm tra lại tiền, thuế trước khi phát hành."
                  : "Order data changed recently, so related invoices were excluded from this issue. Update the data and verify amounts and tax before issuing."}
              </span>
            </div>
          )}

          {summary.excluded_count > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="flex gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                <span>{d.excludedInvoicesWarning(summary.excluded_count)}</span>
              </div>
              <div className="mt-2 grid gap-1.5 border-t border-amber-200 pt-2">
                {preview.excluded.map((invoice) => (
                  <div
                    key={invoice.source_order_document_id}
                    className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"
                  >
                    <span className="font-bold">
                      {invoice.order_number ?? invoice.source_order_id}
                    </span>
                    <span className="break-words text-amber-800">
                      {invoice.issue_codes
                        .map(
                          (code) => `${bulkIssueReason(code, lang)} (${code})`,
                        )
                        .join(" ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] sm:h-9 sm:w-auto"
          >
            {d.back}
          </button>
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={exportingExcel}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 sm:h-9 sm:w-auto"
          >
            {exportingExcel ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            {exportingExcel ? d.exportingExcel : d.exportExcel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 w-full rounded-lg bg-sky-700 px-4 text-xs font-bold text-white transition-all hover:bg-sky-800 active:scale-[0.98] sm:h-9 sm:w-auto"
          >
            {d.confirmAndContinueOtp}
          </button>
        </footer>
      </div>
    </div>
  );
}
