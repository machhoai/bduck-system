"use client";

import {
  createMarketingVoucherCampaignSchema,
  type MarketingVoucherCampaign,
  updateMarketingVoucherCampaignSchema,
} from "@bduck/shared-types";
import { X } from "lucide-react";
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
  const title = campaign ? copy.form.editTitle : copy.form.createTitle;

  useEffect(() => {
    if (campaign) setEditDraft(campaignToDraft(campaign));
    setValidationError("");
  }, [campaign, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, isPending, onClose]);

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

  const renderForm = (layout: "desktop" | "mobile") => (
    <form
      id={`marketing-voucher-campaign-form-${layout}`}
      onSubmit={submit}
      className={
        layout === "desktop"
          ? "flex min-h-0 flex-1 flex-col"
          : "flex flex-col gap-5 pb-2 pt-2"
      }
    >
      <div
        className={
          layout === "desktop"
            ? "min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
            : "space-y-5"
        }
      >
        <div>
          {!campaign ? (
            <p className="text-sm text-slate-500">
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
            className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700"
          >
            {validationError}
          </p>
        ) : null}
      </div>
      <div
        className={
          layout === "desktop"
            ? "flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4"
            : "sticky bottom-0 -mx-4 -mb-6 mt-2 flex gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur"
        }
      >
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="flex-1 h-8 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 md:flex-none inline-flex"
          >
            {copy.action.cancel}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 h-8 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none inline-flex"
          >
            {campaign ? copy.form.submitUpdate : copy.form.submitCreate}
          </button>
      </div>
    </form>
  );

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm md:flex"
          onMouseDown={() => {
            if (!isPending) onClose();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketing-voucher-campaign-modal-title"
            className="flex max-h-[90vh] w-[90%] md:w-[600px] flex-col overflow-hidden rounded-xl border border-white/70 bg-white shadow-2xl shadow-slate-950/20"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-xxs font-semibold uppercase tracking-wider text-amber-700">
                  {copy.title}
                </p>
                <h2
                  id="marketing-voucher-campaign-modal-title"
                  className="mt-1 text-base font-semibold text-slate-950"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                aria-label={copy.action.cancel}
                disabled={isPending}
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </header>
            {renderForm("desktop")}
          </section>
        </div>
      ) : null}

      <BottomSheet
        isOpen={isOpen}
        onClose={() => {
          if (!isPending) onClose();
        }}
        defaultSnap="full"
        title={title}
        zIndex={50}
        contentClassName="flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-6"
      >
        {renderForm("mobile")}
      </BottomSheet>
    </>
  );
}
