"use client";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";
import { LockKeyhole } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { useMarketingVoucherEmailDraftStore } from "@/stores/useMarketingVoucherEmailDraftStore";

import { MarketingVoucherPreview } from "./MarketingVoucherPreview";

const inputClass =
  "mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100";

export function MarketingVoucherEmailComposeStep({
  campaign,
  sampleCode,
}: {
  campaign: MarketingVoucherCampaign;
  sampleCode: MarketingVoucherCode;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers.email;
  const draft = useMarketingVoucherEmailDraftStore((state) => state.draft);
  const update = useMarketingVoucherEmailDraftStore((state) => state.update);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block text-sm font-bold text-slate-700">
          {copy.subject}
          <input
            autoFocus
            required
            maxLength={200}
            value={draft.subject}
            onChange={(event) => update({ subject: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          {copy.introduction}
          <textarea
            rows={6}
            maxLength={5000}
            value={draft.introduction}
            onChange={(event) => update({ introduction: event.target.value })}
            className={inputClass}
          />
        </label>
        <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          <p className="flex items-start gap-2 font-semibold text-slate-700">
            <LockKeyhole size={15} className="mt-0.5 shrink-0" />
            {copy.senderFixed}
          </p>
          <p className="mt-2">{copy.noDesignStep}</p>
        </div>
      </div>
      <section>
        <h3 className="mb-3 text-sm font-bold text-slate-800">
          {copy.preview}
        </h3>
        <div className="space-y-3 rounded-3xl bg-slate-100 p-3">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm font-black text-slate-950">
              {draft.subject || copy.subject}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {draft.introduction}
            </p>
          </div>
          <MarketingVoucherPreview campaign={campaign} code={sampleCode} />
        </div>
      </section>
    </div>
  );
}
