"use client";

import {
  createMarketingVoucherEmailJobSchema,
  type MarketingVoucherCampaign,
  type MarketingVoucherCode,
} from "@bduck/shared-types";
import { Check, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  createMarketingVoucherEmailJob,
  createMarketingVoucherIdempotencyKey,
} from "@/api/marketingVoucherApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";
import { useMarketingVoucherEmailDraftStore } from "@/stores/useMarketingVoucherEmailDraftStore";
import { buildMarketingVoucherEmailRecipients } from "@/utils/marketingVoucherEmailDraft";

import { MarketingVoucherEmailComposeStep } from "./MarketingVoucherEmailComposeStep";
import { MarketingVoucherEmailRecipientsStep } from "./MarketingVoucherEmailRecipientsStep";
import { MarketingVoucherPreview } from "./MarketingVoucherPreview";

export function MarketingVoucherEmailSheet({
  campaign,
  codes,
  onClose,
  onSuccess,
}: {
  campaign: MarketingVoucherCampaign;
  codes: MarketingVoucherCode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const draft = useMarketingVoucherEmailDraftStore((state) => state.draft);
  const begin = useMarketingVoucherEmailDraftStore((state) => state.begin);
  const reset = useMarketingVoucherEmailDraftStore((state) => state.reset);
  const { isPending, runMutation } = useMarketingVoucherMutation();
  const codeSignature = useMemo(
    () =>
      codes
        .map((code) => code.id)
        .sort()
        .join(","),
    [codes],
  );
  const sampleCode = codes[0];

  useEffect(() => {
    begin(
      campaign.id,
      codeSignature ? codeSignature.split(",") : [],
      `${copy.email.title} · ${campaign.name}`,
    );
  }, [begin, campaign.id, campaign.name, codeSignature, copy.email.title]);

  const recipients = buildMarketingVoucherEmailRecipients({
    mode: draft.mode,
    codes,
    groupedEmail: draft.grouped_email,
    individualEmails: draft.individual_emails,
  });
  const next = () => {
    setError("");
    if (step === 2 && !recipients) {
      setError(copy.email.invalidEmails);
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!recipients) {
      setError(copy.email.invalidEmails);
      return;
    }
    const parsed = createMarketingVoucherEmailJobSchema.safeParse({
      campaign_id: campaign.id,
      recipients,
      subject: draft.subject,
      introduction: draft.introduction,
      idempotency_key: createMarketingVoucherIdempotencyKey("email-job"),
      action_time: new Date(),
    });
    if (!parsed.success) {
      setError(copy.form.required);
      return;
    }
    await runMutation({
      key: `email:${campaign.id}:${codeSignature}`,
      task: () =>
        createMarketingVoucherEmailJob(parsed.data, copy.toasts.error),
      messages: { ...copy.toasts, retry: t.common.retry },
      onSuccess: () => {
        reset();
        onSuccess();
        onClose();
      },
    });
  };
  const steps = [
    copy.email.stepSelect,
    copy.email.stepRecipients,
    copy.email.stepCompose,
  ];

  if (!sampleCode) return null;

  return (
    <BottomSheet
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      defaultSnap="full"
      title={copy.email.title}
      desktopClassName="md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[820px] md:rounded-none md:border-0"
      contentClassName="flex-1 overflow-y-auto px-5 pb-8 md:px-7"
    >
      <form onSubmit={submit} className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          {steps.map((label, index) => {
            const number = index + 1;
            return (
              <div
                key={label}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${step >= number ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {step > number ? <Check size={14} /> : number}
                </span>
                <span
                  className={`hidden truncate text-xs font-semibold sm:block ${step >= number ? "text-slate-900" : "text-slate-400"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {copy.email.selected} · {codes.length}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {codes.map((code) => (
                  <span
                    key={code.id}
                    className="rounded bg-slate-100 px-2 py-1 font-mono text-xxs font-semibold text-slate-700"
                  >
                    {code.id}
                  </span>
                ))}
              </div>
            </div>
            <MarketingVoucherPreview campaign={campaign} code={sampleCode} />
          </div>
        ) : null}
        {step === 2 ? (
          <MarketingVoucherEmailRecipientsStep codes={codes} />
        ) : null}
        {step === 3 ? (
          <MarketingVoucherEmailComposeStep
            campaign={campaign}
            sampleCode={sampleCode}
          />
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              step === 1 ? onClose() : setStep((current) => current - 1)
            }
            className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            {step === 1 ? copy.action.cancel : copy.email.back}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            >
              {copy.email.next}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending || !draft.subject.trim()}
              className="h-8 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              <Send size={16} />
              {copy.email.queue}
            </button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
