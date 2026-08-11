"use client";

import { Check, ImagePlus, Trash2 } from "lucide-react";
import { useRef } from "react";

import type { PosTicketSettingsPayload } from "@/api/posManagementApi";

import {
  ReceiptSection,
  ReceiptSlider,
  ReceiptTextField,
} from "./PosReceiptFields";
import { usePosTicketEditorCopy } from "./usePosTicketEditorCopy";

type Update = <K extends keyof PosTicketSettingsPayload>(
  key: K,
  value: PosTicketSettingsPayload[K],
) => void;

const paperSizes = ["POS58", "POS80", "POS82"] as const;

export function PosTicketPaperSection({
  form,
  update,
}: {
  form: PosTicketSettingsPayload;
  update: Update;
}) {
  const { copy } = usePosTicketEditorCopy();
  return (
    <ReceiptSection title={copy.paperTitle} description={copy.paperDescription}>
      <div className="grid gap-2 sm:grid-cols-3">
        {paperSizes.map((paper) => {
          const selected = form.paper_size === paper;
          return (
            <button
              key={paper}
              type="button"
              onClick={() => update("paper_size", paper)}
              className={`relative rounded-xl border p-3 text-left transition-colors ${selected ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-amber-200"}`}
            >
              {selected && (
                <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Check className="size-3" />
                </span>
              )}
              <span className="block text-sm font-bold text-slate-900">
                {paper}
              </span>
              <span
                className={`mt-3 block h-2.5 rounded-sm border-x-2 border-b border-slate-500 ${paper === "POS58" ? "w-[71%]" : paper === "POS80" ? "w-[98%]" : "w-full"}`}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <ReceiptSlider
          label={copy.ticketHeight}
          value={form.ticket_height_mm}
          min={80}
          max={160}
          step={1}
          unit="mm"
          onChange={(value) => update("ticket_height_mm", value)}
        />
      </div>
    </ReceiptSection>
  );
}

export function PosTicketBrandSection({
  form,
  update,
  onLogoFile,
}: {
  form: PosTicketSettingsPayload;
  update: Update;
  onLogoFile: (file: File) => void;
}) {
  const { copy } = usePosTicketEditorCopy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <ReceiptSection title={copy.brandTitle} description={copy.brandDescription}>
      <div className="grid gap-4 md:grid-cols-[150px_1fr]">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
          <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-white">
            {form.logo_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logo_data_url}
                alt={copy.logoAlt}
                width={Math.min(form.logo_width_mm * 3, 125)}
                height={Math.min(form.logo_max_height_mm * 3, 68)}
                className="max-h-16 object-contain grayscale"
              />
            ) : (
              <ImagePlus className="size-7 text-slate-400" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onLogoFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-xs font-bold text-amber-700"
          >
            {form.logo_data_url ? copy.replaceLogo : copy.uploadLogo}
          </button>
          {form.logo_data_url && (
            <button
              type="button"
              onClick={() => update("logo_data_url", null)}
              className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-red-600"
            >
              <Trash2 className="size-3" />
              {copy.removeLogo}
            </button>
          )}
        </div>
        <div className="grid gap-3">
          <ReceiptTextField
            label={copy.storeName}
            value={form.store_name}
            onChange={(value) => update("store_name", value)}
            maxLength={120}
          />
          <ReceiptTextField
            label={copy.ticketTitle}
            value={form.ticket_title}
            onChange={(value) => update("ticket_title", value)}
            maxLength={80}
          />
          <ReceiptTextField
            label={copy.subtitle}
            value={form.subtitle}
            onChange={(value) => update("subtitle", value)}
            maxLength={200}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <ReceiptSlider
          label={copy.logoWidth}
          value={form.logo_width_mm}
          min={5}
          max={70}
          step={1}
          unit="mm"
          onChange={(value) => update("logo_width_mm", value)}
        />
        <ReceiptSlider
          label={copy.logoHeight}
          value={form.logo_max_height_mm}
          min={5}
          max={70}
          step={1}
          unit="mm"
          onChange={(value) => update("logo_max_height_mm", value)}
        />
        <ReceiptSlider
          label={copy.logoContrast}
          value={form.logo_contrast_percent}
          min={50}
          max={250}
          step={5}
          unit="%"
          onChange={(value) => update("logo_contrast_percent", value)}
        />
      </div>
    </ReceiptSection>
  );
}
