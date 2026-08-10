"use client";

import type { PosReceiptSettings } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { RotateCcw, Save } from "lucide-react";
import { useCallback, useState } from "react";

import { posManagementApi, type PosReceiptSettingsPayload } from "@/api/posManagementApi";

import { PosReceiptPaperSection, PosReceiptQrSection, PosReceiptThemeSection } from "./PosReceiptAppearanceSections";
import { PosReceiptBrandSection } from "./PosReceiptBrandSection";
import { PosReceiptAdvancedSection, PosReceiptFontWeightSection } from "./PosReceiptContentSections";
import { createDefaultPosReceiptSettings } from "./posReceiptDefaults";
import { PosReceiptPreview } from "./PosReceiptPreview";
import { usePosManagementCopy } from "./usePosManagementCopy";
import { usePosReceiptEditorCopy } from "./usePosReceiptEditorCopy";

const toPayload = (settings: PosReceiptSettings): PosReceiptSettingsPayload => {
  const {
    id: _id, warehouse_id: _warehouse, version: _version, updated_by: _user,
    is_deleted: _deleted, created_at: _created, updated_at: _updated, ...payload
  } = settings;
  return payload;
};

export function PosSettingsPanel({ warehouseId, storeName, settings, canManage, onChanged }: {
  warehouseId: string;
  storeName: string;
  settings: PosReceiptSettings | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const managementCopy = usePosManagementCopy();
  const { copy } = usePosReceiptEditorCopy();
  const initialForm = settings ? toPayload(settings) : createDefaultPosReceiptSettings(storeName);
  const [form, setForm] = useState<PosReceiptSettingsPayload>(initialForm);
  const [saving, setSaving] = useState(false);
  const update = useCallback(<K extends keyof PosReceiptSettingsPayload>(key: K, value: PosReceiptSettingsPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const action = async () => {
      try {
        await posManagementApi.saveReceiptSettings(warehouseId, form);
        await onChanged();
      } catch (error) {
        console.error("[PosSettingsPanel] Không thể lưu cấu hình hóa đơn:", error);
        throw error;
      }
    };
    const promise = action();
    gooeyToast.promise(promise, {
      loading: copy.saveLoading,
      success: copy.saveSuccess,
      error: copy.saveError,
      description: { success: copy.saveSuccessDescription, error: copy.saveErrorDescription },
      action: { error: { label: copy.retry, onClick: () => { void save(); } } },
    });
    try {
      await promise;
    } catch {
      // Gooey Toast đã hiển thị lỗi thân thiện; lỗi kỹ thuật đã được ghi trong action.
    } finally {
      setSaving(false);
    }
  }, [copy, form, onChanged, saving, warehouseId]);

  const handleLogoFile = useCallback((file: File) => {
    if (!(["image/png", "image/jpeg", "image/webp"] as string[]).includes(file.type)) {
      gooeyToast.error(copy.logoInvalid, { description: copy.logoInvalidDescription });
      return;
    }
    if (file.size > 600 * 1024) {
      gooeyToast.error(copy.logoTooLarge, { description: copy.logoTooLargeDescription });
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      setForm((current) => ({ ...current, logo_data_url: reader.result as string, show_logo: true }));
      gooeyToast.success(copy.logoReady, { description: copy.logoReadyDescription });
    });
    reader.addEventListener("error", () => gooeyToast.error(copy.logoReadError, { description: copy.logoReadErrorDescription }));
    reader.readAsDataURL(file);
  }, [copy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">{managementCopy.receiptTitle}</h2>
          <p className="text-xs text-slate-500">{managementCopy.receiptHint} · {managementCopy.version} {settings?.version ?? 0}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm(createDefaultPosReceiptSettings(storeName))} disabled={saving} className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RotateCcw size={14} /> {copy.reset}</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"><Save size={14} /> {saving ? managementCopy.saving : managementCopy.saveConfig}</button>
          </div>
        )}
      </div>
      <fieldset disabled={!canManage || saving} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-4">
          <PosReceiptPaperSection form={form} update={update} />
          <PosReceiptBrandSection form={form} update={update} onLogoFile={handleLogoFile} />
          <PosReceiptThemeSection form={form} update={update} />
          <PosReceiptQrSection form={form} update={update} />
          <PosReceiptFontWeightSection form={form} update={update} />
          <PosReceiptAdvancedSection form={form} update={update} />
        </div>
        <PosReceiptPreview form={form} />
      </fieldset>
    </div>
  );
}
