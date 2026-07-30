"use client";

import type {
  InvoiceBulkIssueDisplayConfig,
  InvoiceBulkIssueDisplayProduct,
} from "@bduck/shared-types";
import { ArrowRight, Save, Tags, TriangleAlert, X } from "lucide-react";
import { bulkIssueTranslations, type BulkIssueLabels } from "./bulkIssueTranslations";

const inputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100";

function ProductMappingSection({
  products,
  itemNameMapping,
  itemUnitMapping,
  labels,
  disabled,
  onItemNameChange,
  onItemUnitChange,
}: {
  products: InvoiceBulkIssueDisplayProduct[];
  itemNameMapping: Record<string, string>;
  itemUnitMapping: Record<string, string>;
  labels: BulkIssueLabels;
  disabled: boolean;
  onItemNameChange: (source: string, target: string) => void;
  onItemUnitChange: (source: string, target: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-2 border-b border-slate-100 p-3">
        <span className="mt-0.5 text-sky-700">
          <Tags size={16} />
        </span>
        <div>
          <h4 className="text-xs font-bold text-slate-900">
            {labels.productSectionTitle}
          </h4>
          <p className="mt-0.5 text-xxs text-slate-500">
            {labels.productSectionSubtitle(products.length)}
          </p>
        </div>
      </div>
      {products.length === 0 ? (
        <p className="p-4 text-center text-xs text-slate-500">—</p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xxs font-bold uppercase tracking-wide text-slate-500 md:grid">
            <span>{labels.originalProduct}</span>
            <span>{labels.renamedProduct}</span>
            <span>{labels.renamedUnit}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {products.map((product) => (
              <div
                key={product.item_name}
                className="grid gap-2 p-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.7fr)] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-xs font-semibold text-slate-800"
                    title={product.item_name}
                  >
                    {product.item_name}
                  </p>
                  <p className="mt-0.5 text-xxs text-slate-500">
                    {labels.originalUnit}: {product.unit_name || "—"}
                  </p>
                </div>
                <label className="grid gap-1">
                  <span className="text-xxs font-semibold text-slate-500 md:hidden">
                    {labels.renamedProduct}
                  </span>
                  <input
                    value={itemNameMapping[product.item_name] ?? ""}
                    disabled={disabled}
                    aria-label={`${labels.renamedProduct}: ${product.item_name}`}
                    onChange={(event) =>
                      onItemNameChange(product.item_name, event.target.value)
                    }
                    placeholder={labels.keepOriginalName}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xxs font-semibold text-slate-500 md:hidden">
                    {labels.renamedUnit}
                  </span>
                  <input
                    value={itemUnitMapping[product.item_name] ?? ""}
                    disabled={disabled}
                    aria-label={`${labels.renamedUnit}: ${product.item_name}`}
                    onChange={(event) =>
                      onItemUnitChange(product.item_name, event.target.value)
                    }
                    placeholder={product.unit_name || labels.unitPlaceholder}
                    className={inputClass}
                  />
                </label>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function BulkIssueConfigurationModal({
  config,
  itemNameMapping,
  itemUnitMapping,
  dirty,
  saving,
  previewing,
  lang,
  onItemNameChange,
  onItemUnitChange,
  onSave,
  onContinue,
  onCancel,
}: {
  config: InvoiceBulkIssueDisplayConfig | null;
  itemNameMapping: Record<string, string>;
  itemUnitMapping: Record<string, string>;
  dirty: boolean;
  saving: boolean;
  previewing: boolean;
  lang: "vi" | "zh";
  onItemNameChange: (source: string, target: string) => void;
  onItemUnitChange: (source: string, target: string) => void;
  onSave: () => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const busy = saving || previewing;
  const d = bulkIssueTranslations[lang];

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={d.configModalTitle}
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl animate-in slide-in-from-bottom-5 duration-200">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 pt-3 pb-4">
          <div className="flex-1">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            <p className="text-micro font-bold uppercase tracking-wider text-sky-700">
              MISA meInvoice
            </p>
            <h3 className="mt-0.5 text-base font-bold text-slate-950">
              {d.configModalSubtitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {config?.business_date ?? "—"} · {d.configModalDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
            aria-label={d.close}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {!config ? (
            <div
              className="grid animate-pulse gap-3"
              aria-label={d.loadingConfig}
            >
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="h-14 border-b border-slate-100 bg-slate-100" />
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="h-9 rounded bg-slate-100" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ProductMappingSection
              products={config.products}
              itemNameMapping={itemNameMapping}
              itemUnitMapping={itemUnitMapping}
              labels={d}
              disabled={busy}
              onItemNameChange={onItemNameChange}
              onItemUnitChange={onItemUnitChange}
            />
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:p-4">
          {dirty && (
            <p className="mb-2 flex items-center gap-1.5 text-xxs font-medium text-amber-700">
              <TriangleAlert size={13} />
              {d.unsavedChangesWarning}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-9 w-full sm:w-auto rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {d.cancel}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!config || !dirty || busy}
              className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3.5 text-xs font-bold text-sky-800 hover:bg-sky-50 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <Save size={14} />
              {saving ? d.saving : d.saveConfig}
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!config || dirty || busy}
              className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-4 text-xs font-bold text-white hover:bg-sky-800 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <ArrowRight size={14} />
              {previewing ? d.generatingList : d.issueWithConfig}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
