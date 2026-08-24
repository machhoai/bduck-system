"use client";

import type { MarketingVoucherCampaign } from "@bduck/shared-types";
import { useEffect, useState, type FormEvent } from "react";

import {
  changeMarketingVoucherCampaignStatus,
  createMarketingVoucherIdempotencyKey,
  extendMarketingVoucherCampaign,
  generateMarketingVoucherCodes,
  softDeleteMarketingVoucherCampaign,
} from "@/api/marketingVoucherApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";

export type MarketingVoucherCampaignAction =
  | "pause"
  | "activate"
  | "generate"
  | "extend"
  | "end";

const inputClass =
  "mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100";

export function MarketingVoucherCampaignActionSheet({
  campaign,
  action,
  onClose,
}: {
  campaign: MarketingVoucherCampaign | null;
  action: MarketingVoucherCampaignAction | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const [quantity, setQuantity] = useState("100");
  const [validTo, setValidTo] = useState("");
  const [error, setError] = useState("");
  const { isPending, runMutation } = useMarketingVoucherMutation();

  useEffect(() => {
    setQuantity("100");
    setValidTo(campaign?.valid_to ?? "");
    setError("");
  }, [campaign, action]);

  if (!campaign || !action) return null;
  const titles = {
    pause: copy.action.pauseTitle,
    activate: copy.action.activateTitle,
    generate: copy.action.generateTitle,
    extend: copy.action.extendTitle,
    end: copy.action.endTitle,
  };
  const descriptions = {
    pause: copy.action.pauseDescription,
    activate: copy.action.activateDescription,
    generate: "",
    extend: "",
    end: copy.action.endDescription,
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const actionTime = new Date();
    const idempotencyKey = createMarketingVoucherIdempotencyKey(
      `campaign-${action}`,
    );
    let task: () => Promise<unknown>;
    if (action === "generate") {
      const amount = Number(quantity);
      if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
        setError(copy.form.required);
        return;
      }
      task = () =>
        generateMarketingVoucherCodes(
          campaign.id,
          {
            quantity: amount,
            expected_revision: campaign.revision,
            idempotency_key: idempotencyKey,
            action_time: actionTime,
          },
          copy.toasts.error,
        );
    } else if (action === "extend") {
      if (!validTo || validTo <= campaign.valid_to) {
        setError(copy.form.invalidDate);
        return;
      }
      task = () =>
        extendMarketingVoucherCampaign(
          campaign.id,
          {
            valid_to: validTo,
            expected_revision: campaign.revision,
            idempotency_key: idempotencyKey,
            action_time: actionTime,
          },
          copy.toasts.error,
        );
    } else if (action === "end") {
      task = () =>
        softDeleteMarketingVoucherCampaign(
          campaign.id,
          {
            expected_revision: campaign.revision,
            idempotency_key: idempotencyKey,
            action_time: actionTime,
          },
          copy.toasts.error,
        );
    } else {
      task = () =>
        changeMarketingVoucherCampaignStatus(
          campaign.id,
          {
            status: action === "pause" ? "PAUSED" : "ACTIVE",
            expected_revision: campaign.revision,
            idempotency_key: idempotencyKey,
            action_time: actionTime,
          },
          copy.toasts.error,
        );
    }
    await runMutation({
      key: `${action}:${campaign.id}`,
      task,
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
      defaultSnap="half"
      title={titles[action]}
      desktopClassName="md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none md:border-0"
      contentClassName="flex-1 overflow-y-auto px-5 pb-7 md:px-7"
    >
      <form onSubmit={submit} className="pt-6">
        <h2 className="hidden text-xl font-bold text-slate-950 md:block">
          {titles[action]}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {descriptions[action]}
        </p>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {copy.campaigns.title}
          </p>
          <p className="mt-1 font-bold text-slate-950">{campaign.name}</p>
        </div>
        {action === "generate" ? (
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            {copy.action.quantity}
            <input
              autoFocus
              required
              min="1"
              max="1000000"
              type="number"
              className={inputClass}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
        ) : null}
        {action === "extend" ? (
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            {copy.action.newValidTo}
            <input
              autoFocus
              required
              min={campaign.valid_to}
              type="date"
              className={inputClass}
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
            />
          </label>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            className={`rounded-2xl px-5 py-2.5 text-sm font-bold disabled:opacity-50 ${action === "end" ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-amber-500 text-slate-950 hover:bg-amber-400"}`}
          >
            {copy.action.confirm}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
