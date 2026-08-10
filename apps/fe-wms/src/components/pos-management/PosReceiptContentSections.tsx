"use client";

import type { PosReceiptSettingsPayload } from "@/api/posManagementApi";

import { RECEIPT_FONT_WEIGHT_FIELDS, RECEIPT_FONT_WEIGHT_OPTIONS } from "./posReceiptEditorConfig";
import { ReceiptSection, ReceiptTextField, ReceiptToggle } from "./PosReceiptFields";
import { usePosReceiptEditorCopy } from "./usePosReceiptEditorCopy";

type UpdateSettings = <K extends keyof PosReceiptSettingsPayload>(
  key: K,
  value: PosReceiptSettingsPayload[K],
) => void;

export function PosReceiptFontWeightSection({ form, update }: { form: PosReceiptSettingsPayload; update: UpdateSettings }) {
  const { copy, lang } = usePosReceiptEditorCopy();
  return (
    <ReceiptSection title={copy.fontTitle} description={copy.fontDescription}>
      <div className="grid gap-2 md:grid-cols-2">
        {RECEIPT_FONT_WEIGHT_FIELDS.map((field) => (
          <label key={field.key} className="flex min-h-[68px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className="min-w-0">
              <span className={`block text-xs text-slate-900 ${form.font_weights[field.key] >= 900 ? "font-black" : form.font_weights[field.key] >= 800 ? "font-extrabold" : form.font_weights[field.key] >= 700 ? "font-bold" : form.font_weights[field.key] >= 600 ? "font-semibold" : form.font_weights[field.key] >= 500 ? "font-medium" : "font-normal"}`}>{lang === "zh" ? field.zh : field.vi}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{lang === "zh" ? field.zhDescription : field.viDescription}</span>
            </span>
            <select value={form.font_weights[field.key]} onChange={(event) => update("font_weights", { ...form.font_weights, [field.key]: Number(event.target.value) })} className="min-h-10 w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500">
              {RECEIPT_FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{lang === "zh" ? option.zh : option.vi}</option>)}
            </select>
          </label>
        ))}
      </div>
    </ReceiptSection>
  );
}

export function PosReceiptAdvancedSection({ form, update }: { form: PosReceiptSettingsPayload; update: UpdateSettings }) {
  const { copy } = usePosReceiptEditorCopy();
  return (
    <ReceiptSection title={copy.contentTitle} description={copy.contentDescription}>
      <div className="grid gap-3 md:grid-cols-2">
        <ReceiptToggle label={copy.showLogo} description={copy.showLogoDescription} checked={form.show_logo} onChange={(value) => update("show_logo", value)} />
        <ReceiptToggle label={copy.showCashier} description={copy.showCashierDescription} checked={form.show_cashier} onChange={(value) => update("show_cashier", value)} />
        <ReceiptToggle label={copy.showItemTax} description={copy.showItemTaxDescription} checked={form.show_item_tax} onChange={(value) => update("show_item_tax", value)} />
        <ReceiptToggle label={copy.showContact} description={copy.showContactDescription} checked={form.show_contact} onChange={(value) => update("show_contact", value)} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="block text-xs font-bold text-slate-600">
          {copy.defaultTax}
          <div className="relative mt-1">
            <input type="number" min={0} max={100} step={0.1} value={form.default_tax_rate} onChange={(event) => update("default_tax_rate", Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 pr-8 text-sm outline-none focus:border-amber-500" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
          </div>
        </label>
        <ReceiptTextField label={copy.afterSales} value={form.after_sales_text} onChange={(value) => update("after_sales_text", value)} maxLength={500} />
      </div>
      <div className="mt-3"><ReceiptTextField label={copy.footer} value={form.footer_message} onChange={(value) => update("footer_message", value)} maxLength={500} /></div>
    </ReceiptSection>
  );
}
