"use client";

import type { RevenueExportReportType } from "@bduck/shared-types";
import { Download, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useRevenueExportProducts } from "@/hooks/useRevenueExportProducts";
import { useTranslation } from "@/lib/i18n";
import type {
  ExportRequestOptions,
  RevenueExportDialogConfig,
} from "@/utils/exportExcel";

import { RevenueExportProductEditor } from "./RevenueExportProductEditor";

interface RevenueExportModalProps {
  isOpen: boolean;
  config: RevenueExportDialogConfig;
  isExporting: boolean;
  onClose: () => void;
  onSubmit: (options: ExportRequestOptions) => Promise<void>;
}

export function RevenueExportModal(props: RevenueExportModalProps) {
  return props.isOpen ? (
    <RevenueExportForm key={props.config.contextKey} {...props} />
  ) : null;
}

function RevenueExportForm({
  config,
  isExporting,
  onClose,
  onSubmit,
}: RevenueExportModalProps) {
  const { t } = useTranslation();
  const copy = t.revenue.export;
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef<HTMLElement>(null);
  const [reportType, setReportType] =
    useState<RevenueExportReportType>("DAILY_REVENUE");
  const [roundMoney, setRoundMoney] = useState(false);
  const products = config.products ?? [];
  const editor = useRevenueExportProducts(
    products,
    config.source ?? "LOCAL_POS",
  );
  const hasProducts = reportType !== "DAILY_REVENUE";
  const disabled =
    isExporting ||
    (hasProducts &&
      (Boolean(config.productsLoading || config.productsError) ||
        editor.preferencesLoading ||
        !editor.selected.length));

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const options = [
    {
      value: "DAILY_REVENUE" as const,
      label: copy.dailyRevenue,
      description: copy.dailyRevenueDescription,
      disabled: false,
    },
    {
      value: "SALES_COMPOSITION" as const,
      label: copy.salesComposition,
      description: copy.salesCompositionDescription,
      disabled: false,
    },
    {
      value: "INVOICE_PREPARATION" as const,
      label: copy.invoicePreparation,
      description:
        config.source === "LOCAL_POS"
          ? copy.invoicePreparationDescription
          : copy.invoiceLocalOnly,
      disabled: config.source !== "LOCAL_POS",
    },
  ];
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExporting) onClose();
      }}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl outline-none sm:rounded-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !isExporting) onClose();
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ),
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              {config.title}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-slate-500">
              {config.description}
            </p>
          </div>
          <button
            type="button"
            aria-label={copy.close}
            disabled={isExporting}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5">
          <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
            {[
              [copy.warehouseLabel, config.warehouseName],
              [copy.sourceLabel, config.sourceLabel],
              [copy.rangeLabel, config.rangeLabel],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold text-slate-500">{label}</dt>
                <dd className="mt-1 font-bold text-slate-800">
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
          <fieldset disabled={isExporting}>
            <legend className="mb-2 text-sm font-semibold text-slate-700">
              {copy.reportTypeLabel}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {options.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${option.disabled ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60" : reportType === option.value ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <input
                    type="radio"
                    name={titleId}
                    value={option.value}
                    checked={reportType === option.value}
                    disabled={isExporting || option.disabled}
                    onChange={() => setReportType(option.value)}
                    className="mt-1 accent-emerald-600"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {reportType === "INVOICE_PREPARATION" && (
            <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
              <p>{copy.invoiceSourceHint}</p>
              <label className="flex min-h-9 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={roundMoney}
                  disabled={isExporting}
                  onChange={(event) => setRoundMoney(event.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                {copy.roundMoney}
              </label>
              <p>{copy.roundMoneyDescription}</p>
            </div>
          )}
          {hasProducts && (
            <RevenueExportProductEditor
              products={products}
              editor={editor}
              disabled={isExporting || editor.preferencesLoading}
              loading={config.productsLoading}
              error={config.productsError}
            />
          )}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="h-11 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              void onSubmit({
                reportType,
                products: hasProducts ? editor.payload : undefined,
                roundMoney:
                  reportType === "INVOICE_PREPARATION" ? roundMoney : undefined,
              })
            }
            className="flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? copy.loading : copy.confirm}
          </button>
        </footer>
      </section>
    </div>
  );
}
