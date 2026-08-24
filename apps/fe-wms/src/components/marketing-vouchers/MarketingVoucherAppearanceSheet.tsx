"use client";

import type { MarketingVoucherCampaign } from "@bduck/shared-types";
import { Check } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  createMarketingVoucherIdempotencyKey,
  updateMarketingVoucherAppearance,
} from "@/api/marketingVoucherApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";

import { MarketingVoucherPreview } from "./MarketingVoucherPreview";

const presets = [
  { value: "#F5C542", className: "bg-[#F5C542]" },
  { value: "#F97316", className: "bg-orange-500" },
  { value: "#EF4444", className: "bg-red-500" },
  { value: "#EC4899", className: "bg-pink-500" },
  { value: "#8B5CF6", className: "bg-violet-500" },
  { value: "#3B82F6", className: "bg-blue-500" },
  { value: "#14B8A6", className: "bg-teal-500" },
  { value: "#22C55E", className: "bg-green-500" },
] as const;

export function MarketingVoucherAppearanceSheet({
  campaign,
  onClose,
}: {
  campaign: MarketingVoucherCampaign | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const [color, setColor] = useState("#F5C542");
  const { isPending, runMutation } = useMarketingVoucherMutation();

  useEffect(() => {
    if (campaign) setColor(campaign.accent_color.toUpperCase());
  }, [campaign]);

  if (!campaign) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      accent_color: color.toUpperCase(),
      expected_revision: campaign.revision,
      idempotency_key: createMarketingVoucherIdempotencyKey("appearance"),
      action_time: new Date(),
    };
    await runMutation({
      key: `appearance:${campaign.id}`,
      task: () =>
        updateMarketingVoucherAppearance(
          campaign.id,
          payload,
          copy.toasts.error,
        ),
      messages: { ...copy.toasts, retry: t.common.retry },
      onSuccess: onClose,
    });
  };

  return (
    <BottomSheet
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      defaultSnap="full"
      title={copy.appearance.title}
      desktopClassName="md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[720px] md:rounded-none md:border-0"
      contentClassName="flex-1 overflow-y-auto px-5 pb-8 md:px-7"
    >
      <form onSubmit={submit} className="space-y-6 pt-6">
        <div>
          <h2 className="hidden text-xl font-bold text-slate-950 md:block">
            {copy.appearance.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {copy.appearance.hint}
          </p>
        </div>
        <fieldset>
          <legend className="text-sm font-bold text-slate-800">
            {copy.appearance.choose}
          </legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={preset.value}
                aria-pressed={color === preset.value}
                onClick={() => setColor(preset.value)}
                className={`grid h-11 w-11 place-items-center rounded-2xl ring-2 ring-offset-2 transition ${preset.className} ${color === preset.value ? "ring-slate-950" : "ring-transparent hover:ring-slate-300"}`}
              >
                {color === preset.value ? (
                  <Check className="text-white drop-shadow" size={18} />
                ) : null}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-bold text-slate-800">
          {copy.appearance.custom}
          <span className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              className="h-10 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0"
            />
            <span className="font-mono text-sm font-bold text-slate-700">
              {color}
            </span>
          </span>
        </label>
        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-800">
            {copy.appearance.preview}
          </h3>
          <MarketingVoucherPreview campaign={campaign} accentColor={color} />
        </section>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" disabled={isPending} onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {copy.action.cancel}
          </button>
          <button type="submit" disabled={isPending || color === campaign.accent_color.toUpperCase()} className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
            {copy.appearance.save}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
