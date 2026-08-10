"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef } from "react";

import type { PosReceiptSettingsPayload } from "@/api/posManagementApi";

import { ReceiptSection, ReceiptSlider, ReceiptTextField } from "./PosReceiptFields";
import { usePosReceiptEditorCopy } from "./usePosReceiptEditorCopy";

export function PosReceiptBrandSection({ form, update, onLogoFile }: {
  form: PosReceiptSettingsPayload;
  update: <K extends keyof PosReceiptSettingsPayload>(key: K, value: PosReceiptSettingsPayload[K]) => void;
  onLogoFile: (file: File) => void;
}) {
  const { copy } = usePosReceiptEditorCopy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <ReceiptSection title={copy.brandTitle} description={copy.brandDescription}>
      <div className="grid gap-4 md:grid-cols-[150px_1fr]">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
          <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-white">
            {form.logo_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_data_url} alt={copy.logoAlt} width={Math.min(form.logo_width_mm * 3, 125)} height={Math.min(form.logo_max_height_mm * 3, 68)} className="max-h-16 object-contain grayscale" />
            ) : <ImagePlus className="size-7 text-slate-400" />}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onLogoFile(file);
          }} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs font-bold text-amber-700">
            {form.logo_data_url ? copy.replaceLogo : copy.uploadLogo}
          </button>
          {form.logo_data_url && (
            <button type="button" onClick={() => update("logo_data_url", null)} className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-red-600">
              <Trash2 className="size-3" /> {copy.removeLogo}
            </button>
          )}
        </div>
        <div className="grid gap-3">
          <ReceiptTextField label={copy.storeName} value={form.store_name} onChange={(value) => update("store_name", value)} maxLength={120} />
          <ReceiptTextField label={copy.address} value={form.store_address} onChange={(value) => update("store_address", value)} maxLength={300} />
          <ReceiptTextField label={copy.hotline} value={form.hotline} onChange={(value) => update("hotline", value)} maxLength={50} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <ReceiptSlider label={copy.logoWidth} value={form.logo_width_mm} min={12} max={50} step={1} unit="mm" onChange={(value) => update("logo_width_mm", value)} />
        <ReceiptSlider label={copy.logoHeight} value={form.logo_max_height_mm} min={8} max={30} step={1} unit="mm" onChange={(value) => update("logo_max_height_mm", value)} />
        <ReceiptSlider label={copy.logoContrast} value={form.logo_contrast_percent} min={80} max={200} step={5} unit="%" onChange={(value) => update("logo_contrast_percent", value)} />
      </div>
    </ReceiptSection>
  );
}
