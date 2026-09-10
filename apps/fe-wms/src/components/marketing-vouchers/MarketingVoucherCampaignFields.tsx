import type {
  MarketingVoucherCampaign,
  MarketingVoucherCampaignPurpose,
  MarketingVoucherRewardType,
} from "@bduck/shared-types";

import type { Dictionary } from "@/lib/i18n/vi";
import type { MarketingVoucherCampaignDraft } from "@/stores/useMarketingVoucherDraftStore";

const inputClass =
  "mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-500";
const textAreaClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-500";

export function MarketingVoucherCampaignFields({
  campaign,
  draft,
  copy,
  updateDraft,
}: {
  campaign: MarketingVoucherCampaign | null;
  draft: MarketingVoucherCampaignDraft;
  copy: Dictionary["marketingVouchers"];
  updateDraft: (patch: Partial<MarketingVoucherCampaignDraft>) => void;
}) {
  return (
    <>
      <label className="block text-xs font-semibold text-slate-700">
        {copy.form.name}
        <input
          required
          maxLength={160}
          className={inputClass}
          value={draft.name}
          onChange={(event) => updateDraft({ name: event.target.value })}
        />
      </label>
      <label className="block text-xs font-semibold text-slate-700">
        {copy.form.description}
        <textarea
          maxLength={2000}
          rows={3}
          className={textAreaClass}
          value={draft.description}
          onChange={(event) => updateDraft({ description: event.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {copy.form.rewardType}
          <select
            className={inputClass}
            value={draft.reward_type}
            onChange={(event) =>
              updateDraft({
                reward_type: event.target.value as MarketingVoucherRewardType,
              })
            }
          >
            {Object.entries(copy.rewardType).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {copy.form.rewardValue}
          <input
            required
            min="0"
            max="1000000000"
            step="any"
            type="number"
            className={inputClass}
            value={draft.reward_value}
            onChange={(event) =>
              updateDraft({ reward_value: event.target.value })
            }
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {copy.form.validFrom}
          <input
            required
            type="date"
            className={inputClass}
            value={draft.valid_from}
            onChange={(event) =>
              updateDraft({ valid_from: event.target.value })
            }
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {copy.form.validTo}
          <input
            required
            type="date"
            className={inputClass}
            disabled={Boolean(campaign?.code_counts.total)}
            value={draft.valid_to}
            onChange={(event) => updateDraft({ valid_to: event.target.value })}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {copy.form.purpose}
          <select
            className={inputClass}
            value={draft.purpose}
            onChange={(event) =>
              updateDraft({
                purpose: event.target.value as MarketingVoucherCampaignPurpose,
              })
            }
          >
            {Object.entries(copy.purpose).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {!campaign ? (
          <label className="block text-xs font-semibold text-slate-700">
            {copy.form.quantity}
            <input
              required
              min="1"
              max="1000000"
              type="number"
              className={inputClass}
              value={draft.requested_code_count}
              onChange={(event) =>
                updateDraft({ requested_code_count: event.target.value })
              }
            />
          </label>
        ) : null}
      </div>
      {!campaign ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-700">
            {copy.form.prefix}
            <input
              maxLength={20}
              className={inputClass}
              value={draft.prefix}
              onChange={(event) => updateDraft({ prefix: event.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            {copy.form.codeLength}
            <input
              required
              min="4"
              max="12"
              type="number"
              className={inputClass}
              value={draft.code_length}
              onChange={(event) =>
                updateDraft({ code_length: event.target.value })
              }
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            {copy.form.suffix}
            <input
              maxLength={20}
              className={inputClass}
              value={draft.suffix}
              onChange={(event) => updateDraft({ suffix: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </>
  );
}
