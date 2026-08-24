"use client";

import {
  createMarketingVoucherCampaignSchema,
  type MarketingVoucherCampaign,
  updateMarketingVoucherCampaignSchema,
} from "@bduck/shared-types";
import { useEffect, useState, type FormEvent } from "react";

import {
  createMarketingVoucherCampaign,
  createMarketingVoucherIdempotencyKey,
  updateMarketingVoucherCampaign,
} from "@/api/marketingVoucherApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";
import {
  emptyMarketingVoucherCampaignDraft,
  useMarketingVoucherDraftStore,
  type MarketingVoucherCampaignDraft,
} from "@/stores/useMarketingVoucherDraftStore";

import { MarketingVoucherCampaignFields } from "./MarketingVoucherCampaignFields";

const campaignToDraft = (
  campaign: MarketingVoucherCampaign,
): MarketingVoucherCampaignDraft => ({
  name: campaign.name,
  description: campaign.description,
  reward_type: campaign.reward_type,
  reward_value: String(campaign.reward_value),
  valid_from: campaign.valid_from,
  valid_to: campaign.valid_to,
  prefix: campaign.prefix,
  code_length: String(campaign.code_length),
  suffix: campaign.suffix,
  purpose: campaign.purpose,
  accent_color: campaign.accent_color,
  requested_code_count: "1",
});

export function MarketingVoucherCampaignFormSheet({
  isOpen,
  campaign,
  onClose,
}: {
  isOpen: boolean;
  campaign: MarketingVoucherCampaign | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const storedDraft = useMarketingVoucherDraftStore((state) => state.campaign);
  const updateStoredDraft = useMarketingVoucherDraftStore(
    (state) => state.updateCampaign,
  );
  const resetStoredDraft = useMarketingVoucherDraftStore(
    (state) => state.resetCampaign,
  );
  const [editDraft, setEditDraft] = useState(
    emptyMarketingVoucherCampaignDraft(),
  );
  const [validationError, setValidationError] = useState("");
  const { isPending, runMutation } = useMarketingVoucherMutation();
  const draft = campaign ? editDraft : storedDraft;

  useEffect(() => {
    if (campaign) setEditDraft(campaignToDraft(campaign));
    setValidationError("");
  }, [campaign, isOpen]);

  const updateDraft = (patch: Partial<MarketingVoucherCampaignDraft>) => {
    if (campaign) setEditDraft((current) => ({ ...current, ...patch }));
    else updateStoredDraft(patch);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationError("");
    const actionTime = new Date();
    const idempotencyKey = createMarketingVoucherIdempotencyKey(
      campaign ? "campaign-update" : "campaign-create",
    );
    const base = {
      name: draft.name,
      description: draft.description,
      reward_type: draft.reward_type,
      reward_value: Number(draft.reward_value),
      valid_from: draft.valid_from,
      valid_to: draft.valid_to,
      purpose: draft.purpose,
      idempotency_key: idempotencyKey,
      action_time: actionTime,
    };
    const parsed = campaign
      ? updateMarketingVoucherCampaignSchema.safeParse({
          ...base,
          valid_to: campaign.code_counts.total > 0 ? undefined : base.valid_to,
          expected_revision: campaign.revision,
        })
      : createMarketingVoucherCampaignSchema.safeParse({
          ...base,
          prefix: draft.prefix.toUpperCase(),
          code_length: Number(draft.code_length),
          suffix: draft.suffix.toUpperCase(),
          accent_color: draft.accent_color.toUpperCase(),
          requested_code_count: Number(draft.requested_code_count),
        });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      setValidationError(
        issue === "VALID_TO_BEFORE_VALID_FROM"
          ? copy.form.invalidDate
          : issue === "REQUESTED_CODE_COUNT_EXCEEDS_SAFE_CODE_SPACE"
            ? copy.form.unsafeCodeSpace
            : copy.form.required,
      );
      return;
    }
    if (campaign) {
      const updateInput = updateMarketingVoucherCampaignSchema.parse(
        parsed.data,
      );
      await runMutation({
        key: `update:${campaign.id}`,
        task: () =>
          updateMarketingVoucherCampaign(
            campaign.id,
            updateInput,
            copy.toasts.error,
          ),
        messages: { ...copy.toasts, retry: t.common.retry },
        onSuccess: onClose,
      });
      return;
    }
    const createInput = createMarketingVoucherCampaignSchema.parse(parsed.data);
    await runMutation({
      key: "create",
      task: () =>
        createMarketingVoucherCampaign(createInput, copy.toasts.error),
      messages: { ...copy.toasts, retry: t.common.retry },
      onSuccess: () => {
        resetStoredDraft();
        onClose();
      },
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        if (!isPending) onClose();
      }}
      defaultSnap="full"
      title={campaign ? copy.form.editTitle : copy.form.createTitle}
      desktopClassName="md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[560px] md:rounded-none md:border-0"
      contentClassName="flex-1 overflow-y-auto px-5 pb-8 md:px-7"
    >
      <form onSubmit={submit} className="space-y-5 pt-5">
        <div>
          <h2 className="hidden text-xl font-bold text-slate-950 md:block">
            {campaign ? copy.form.editTitle : copy.form.createTitle}
          </h2>
          {!campaign ? (
            <p className="mt-1 text-sm text-slate-500">
              {copy.form.saveDraftHint}
            </p>
          ) : null}
        </div>
        <MarketingVoucherCampaignFields
          campaign={campaign}
          draft={draft}
          copy={copy}
          updateDraft={updateDraft}
        />
        {validationError ? (
          <p
            role="alert"
            className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            {validationError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {copy.action.cancel}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {campaign ? copy.form.submitUpdate : copy.form.submitCreate}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
