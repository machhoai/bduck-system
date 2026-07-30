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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-xxs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      {d.productCol}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {d.unitCol}
                    </th>
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
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xxs font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {invoice.order_number ?? invoice.source_order_id}
                      </p>
                      <p className="mt-0.5 text-xxs text-slate-500">
                        {invoice.payment_time} · {d.productsCount(invoice.products.length)}
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
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 text-xxs font-bold text-sky-800 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-50"
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

          {summary.excluded_count > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>
                {d.excludedInvoicesWarning(summary.excluded_count)}
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
            {d.back}
          </button>
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={exportingExcel}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 sm:w-auto"
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
            className="h-9 w-full sm:w-auto rounded-lg bg-sky-700 px-4 text-xs font-bold text-white hover:bg-sky-800 active:scale-[0.98] transition-all"
          >
            {d.confirmAndContinueOtp}
          </button>
        </footer>
      </div>
    </div>
  );
}
