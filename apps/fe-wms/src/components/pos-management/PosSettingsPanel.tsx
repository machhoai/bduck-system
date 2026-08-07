"use client";

import type { PosReceiptSettings } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Save } from "lucide-react";
import { useState } from "react";

import { posManagementApi, type PosReceiptSettingsPayload } from "@/api/posManagementApi";

import { createDefaultPosReceiptSettings } from "./posReceiptDefaults";
import { usePosManagementCopy } from "./usePosManagementCopy";

const toPayload = (settings: PosReceiptSettings): PosReceiptSettingsPayload => {
  const { id: _id, warehouse_id: _warehouse, version: _version, updated_by: _user,
    is_deleted: _deleted, created_at: _created, updated_at: _updated, ...payload } = settings;
  return payload;
};

export function PosSettingsPanel({ warehouseId, storeName, settings, canManage, onChanged }: {
  warehouseId: string;
  storeName: string;
  settings: PosReceiptSettings | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const copy = usePosManagementCopy();
  const [form, setForm] = useState<PosReceiptSettingsPayload>(() =>
    settings ? toPayload(settings) : createDefaultPosReceiptSettings(storeName),
  );
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof PosReceiptSettingsPayload>(key: K, value: PosReceiptSettingsPayload[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      await posManagementApi.saveReceiptSettings(warehouseId, form);
      gooeyToast.success(copy.receiptSaved);
      await onChanged();
    } catch (error) {
      gooeyToast.error(error instanceof Error ? error.message : copy.receiptTitle);
    } finally {
      setSaving(false);
    }
  };
  const toggles = [
    ["show_logo", copy.showLogo], ["show_cashier", copy.showCashier],
    ["show_contact", copy.showContact], ["show_item_tax", copy.showItemTax],
    ["show_invoice_request_qr", copy.invoiceQr], ["show_theme_message", copy.themeMessage],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-black text-slate-900">{copy.receiptTitle}</h2><p className="text-xs text-slate-500">{copy.receiptHint} · {copy.version} {settings?.version ?? 0}</p></div>{canManage && <button type="button" onClick={() => void save()} disabled={saving} className="flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white disabled:opacity-50"><Save size={14} /> {saving ? copy.saving : copy.saveConfig}</button>}</div>
      <fieldset disabled={!canManage || saving} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={copy.storeName} value={form.store_name} onChange={(value) => update("store_name", value)} />
        <Field label={copy.hotline} value={form.hotline} onChange={(value) => update("hotline", value)} />
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-600">{copy.address}</span><input value={form.store_address} onChange={(event) => update("store_address", event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-500" /></label>
        <label><span className="text-xs font-bold text-slate-600">{copy.paper}</span><select value={form.paper_size} onChange={(event) => update("paper_size", event.target.value as PosReceiptSettingsPayload["paper_size"])} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="POS58">POS 58 mm</option><option value="POS80">POS 80 mm</option><option value="POS82">POS 82 mm</option></select></label>
        <label><span className="text-xs font-bold text-slate-600">{copy.theme}</span><select value={form.theme} onChange={(event) => update("theme", event.target.value as PosReceiptSettingsPayload["theme"])} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="CLASSIC">{copy.classic}</option><option value="NATIONAL_DAY">{copy.nationalDay}</option><option value="TET">{copy.tet}</option></select></label>
        <label><span className="text-xs font-bold text-slate-600">{copy.tax}</span><input type="number" min={0} max={100} value={form.default_tax_rate} onChange={(event) => update("default_tax_rate", Number(event.target.value))} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <Field label={copy.thanks} value={form.footer_message} onChange={(value) => update("footer_message", value)} />
      </fieldset>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{toggles.map(([key, label]) => <Toggle key={key} label={label} checked={form[key]} disabled={!canManage} onChange={(value) => update(key, value)} />)}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-xs font-bold text-slate-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-500" /></label>; }
function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) { return <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-amber-500" />{label}</label>; }
