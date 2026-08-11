"use client";

import type { PosPaymentSettings, PosPaymentSettingsInput } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Landmark, Save } from "lucide-react";
import { useState } from "react";

import { posManagementApi } from "@/api/posManagementApi";

import { usePosManagementCopy } from "./usePosManagementCopy";

const EMPTY: PosPaymentSettingsInput = {
  enabled: false,
  fixedTransferOnly: false,
  bankBin: "",
  accountNumber: "",
  accountName: "",
};

export function PosPaymentSettingsPanel({ warehouseId, settings, canManage, onChanged }: {
  warehouseId: string;
  settings: PosPaymentSettings | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const copy = usePosManagementCopy();
  const [form, setForm] = useState<PosPaymentSettingsInput>(() => settings ? {
    enabled: settings.enabled,
    fixedTransferOnly: settings.fixedTransferOnly === true,
    bankBin: settings.bankBin,
    accountNumber: settings.accountNumber,
    accountName: settings.accountName,
  } : EMPTY);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await posManagementApi.savePaymentSettings(warehouseId, form);
      gooeyToast.success(copy.paymentSaved);
      await onChanged();
    } catch (error) {
      gooeyToast.error(error instanceof Error ? error.message : copy.paymentTitle);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Landmark size={18} className="text-amber-600" /><div><h2 className="text-sm font-black text-slate-900">{copy.paymentTitle}</h2><p className="text-xs text-slate-500">{copy.paymentHint}</p></div></div>
        {canManage && <button type="button" onClick={() => void save()} disabled={saving} className="flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white disabled:opacity-50"><Save size={14} /> {copy.savePayment}</button>}
      </div>
      <fieldset disabled={!canManage || saving} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={copy.bankBin} value={form.bankBin} onChange={(value) => setForm((current) => ({ ...current, bankBin: value.replace(/\D/g, "").slice(0, 6) }))} />
        <Field label={copy.accountNumber} value={form.accountNumber} onChange={(value) => setForm((current) => ({ ...current, accountNumber: value.replace(/\D/g, "").slice(0, 19) }))} />
        <Field label={copy.accountName} value={form.accountName} onChange={(value) => setForm((current) => ({ ...current, accountName: value.slice(0, 50) }))} />
      </fieldset>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={form.enabled} disabled={!canManage || saving} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked, ...(!event.target.checked ? { fixedTransferOnly: false } : {}) }))} className="h-4 w-4 accent-amber-500" />
          {copy.enableFallback}
        </label>
        <label className="flex min-h-10 items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">
          <input type="checkbox" checked={form.fixedTransferOnly} disabled={!canManage || saving} onChange={(event) => setForm((current) => ({ ...current, fixedTransferOnly: event.target.checked, ...(event.target.checked ? { enabled: true } : {}) }))} className="mt-0.5 h-4 w-4 accent-blue-600" />
          <span>{copy.fixedTransferOnly}<span className="mt-0.5 block font-normal text-blue-700">{copy.fixedTransferOnlyHint}</span></span>
        </label>
      </div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="text-xs font-bold text-slate-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>;
}
