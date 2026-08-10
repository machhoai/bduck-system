"use client";

import { Check, Info } from "lucide-react";

import type { PosReceiptSettingsPayload } from "@/api/posManagementApi";

import { RECEIPT_PAPER_PROFILES, RECEIPT_THEMES } from "./posReceiptEditorConfig";
import { ReceiptSection, ReceiptSlider, ReceiptTextField, ReceiptToggle } from "./PosReceiptFields";
import { usePosReceiptEditorCopy } from "./usePosReceiptEditorCopy";

type UpdateSettings = <K extends keyof PosReceiptSettingsPayload>(
  key: K,
  value: PosReceiptSettingsPayload[K],
) => void;

export function PosReceiptPaperSection({ form, update }: { form: PosReceiptSettingsPayload; update: UpdateSettings }) {
  const { copy, lang } = usePosReceiptEditorCopy();
  return (
    <ReceiptSection title={copy.paperTitle} description={copy.paperDescription}>
      <div className="grid gap-2 sm:grid-cols-3">
        {RECEIPT_PAPER_PROFILES.map((profile) => {
          const selected = form.paper_size === profile.id;
          return (
            <button key={profile.id} type="button" onClick={() => update("paper_size", profile.id)} className={`relative rounded-xl border p-3 text-left transition-colors ${selected ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-amber-200"}`}>
              {selected && <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-white"><Check className="size-3" /></span>}
              <span className="block text-sm font-bold text-slate-900">{profile.id}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{lang === "zh" ? profile.zh : profile.vi}</span>
              <span className={`mt-3 block h-2.5 rounded-sm border-x-2 border-b border-slate-500 ${profile.id === "POS58" ? "w-[71%]" : profile.id === "POS80" ? "w-[98%]" : "w-full"}`} />
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-700"><Info className="mt-0.5 size-4 shrink-0" />{copy.paperNotice}</p>
    </ReceiptSection>
  );
}

export function PosReceiptThemeSection({ form, update }: { form: PosReceiptSettingsPayload; update: UpdateSettings }) {
  const { copy, lang } = usePosReceiptEditorCopy();
  const activeTheme = RECEIPT_THEMES.find((theme) => theme.id === form.theme) ?? RECEIPT_THEMES[0];
  return (
    <ReceiptSection title={copy.themeTitle} description={copy.themeDescription}>
      <div className="grid gap-2 sm:grid-cols-3">
        {RECEIPT_THEMES.map((theme) => (
          <button key={theme.id} type="button" onClick={() => update("theme", theme.id)} className={`rounded-xl border p-3 text-left transition-colors ${form.theme === theme.id ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-amber-200"}`}>
            <span className="block text-sm font-bold text-slate-900">{lang === "zh" ? theme.zh : theme.vi}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{lang === "zh" ? theme.zhDescription : theme.viDescription}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <ReceiptToggle label={copy.showTheme} description={copy.showThemeDescription} checked={form.show_theme_message} onChange={(value) => update("show_theme_message", value)} />
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
          <ReceiptTextField label={`${copy.themeText} · ${lang === "zh" ? activeTheme.zh : activeTheme.vi}`} value={form.theme_messages[form.theme] ?? ""} onChange={(value) => update("theme_messages", { ...form.theme_messages, [form.theme]: value })} maxLength={300} />
          <ReceiptSlider label={copy.themeFontSize} value={form.theme_message_font_size_pt} min={8} max={16} step={0.5} unit="pt" onChange={(value) => update("theme_message_font_size_pt", value)} />
        </div>
      </div>
    </ReceiptSection>
  );
}

export function PosReceiptQrSection({ form, update }: { form: PosReceiptSettingsPayload; update: UpdateSettings }) {
  const { copy } = usePosReceiptEditorCopy();
  return (
    <ReceiptSection title={copy.qrTitle} description={copy.qrDescription}>
      <ReceiptToggle label={copy.showQr} description={copy.showQrDescription} checked={form.show_invoice_request_qr} onChange={(value) => update("show_invoice_request_qr", value)} />
      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <ReceiptSlider label={copy.qrSize} value={form.invoice_qr_size_mm} min={22} max={50} step={1} unit="mm" onChange={(value) => update("invoice_qr_size_mm", value)} />
        <ReceiptSlider label={copy.qrTitleSize} value={form.invoice_qr_title_font_size_pt} min={7} max={14} step={0.5} unit="pt" onChange={(value) => update("invoice_qr_title_font_size_pt", value)} />
        <ReceiptSlider label={copy.qrHintSize} value={form.invoice_qr_hint_font_size_pt} min={6} max={12} step={0.5} unit="pt" onChange={(value) => update("invoice_qr_hint_font_size_pt", value)} />
      </div>
    </ReceiptSection>
  );
}
