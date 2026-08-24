"use client";

import type { MarketingVoucherCode } from "@bduck/shared-types";
import { Mail, Mails } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { useMarketingVoucherEmailDraftStore } from "@/stores/useMarketingVoucherEmailDraftStore";

const inputClass =
  "mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100";

export function MarketingVoucherEmailRecipientsStep({
  codes,
}: {
  codes: MarketingVoucherCode[];
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers.email;
  const draft = useMarketingVoucherEmailDraftStore((state) => state.draft);
  const update = useMarketingVoucherEmailDraftStore((state) => state.update);
  const setIndividualEmail = useMarketingVoucherEmailDraftStore(
    (state) => state.setIndividualEmail,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["GROUPED", copy.grouped, copy.groupedHint, Mails],
            ["INDIVIDUAL", copy.individual, copy.individualHint, Mail],
          ] as const
        ).map(([mode, title, hint, Icon]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={draft.mode === mode}
            onClick={() => update({ mode })}
            className={`rounded-2xl border p-4 text-left transition ${draft.mode === mode ? "border-amber-500 bg-amber-50 ring-2 ring-amber-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <Icon size={19} className="text-amber-700" />
            <p className="mt-3 text-sm font-bold text-slate-950">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
          </button>
        ))}
      </div>
      {draft.mode === "GROUPED" ? (
        <label className="block text-sm font-bold text-slate-700">
          {copy.recipient}
          <input
            autoFocus
            required
            type="email"
            value={draft.grouped_email}
            onChange={(event) => update({ grouped_email: event.target.value })}
            className={inputClass}
          />
        </label>
      ) : (
        <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
          {codes.map((code) => (
            <label
              key={code.id}
              className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700"
            >
              {copy.recipientFor} <span className="font-mono">{code.id}</span>
              <input
                required
                type="email"
                value={draft.individual_emails[code.id] ?? ""}
                onChange={(event) =>
                  setIndividualEmail(code.id, event.target.value)
                }
                className={inputClass}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
