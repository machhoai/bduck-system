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
  "mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";
const textAreaClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";

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
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700">
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
        <label className="block text-xs font-semibold text-slate-700">
          {copy.introduction}
          <textarea
            rows={6}
            maxLength={5000}
            value={draft.introduction}
            onChange={(event) => update({ introduction: event.target.value })}
            className={textAreaClass}
          />
        </label>
        <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <p className="flex items-start gap-2 font-semibold text-slate-700">
            <LockKeyhole size={14} className="mt-0.5 shrink-0" />
            {copy.senderFixed}
          </p>
          <p className="mt-1">{copy.noDesignStep}</p>
        </div>
      </div>
      <section>
        <h3 className="mb-2 text-xs font-semibold text-slate-800">
          {copy.preview}
        </h3>
        <div className="space-y-3 rounded-xl bg-slate-100 p-3">
          <div className="rounded-lg bg-white p-3">
            <p className="text-sm font-bold text-slate-950">
              {draft.subject || copy.subject}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {draft.introduction}
            </p>
          </div>
          <MarketingVoucherPreview campaign={campaign} code={sampleCode} />
        </div>
      </section>
    </div>
  );
}
