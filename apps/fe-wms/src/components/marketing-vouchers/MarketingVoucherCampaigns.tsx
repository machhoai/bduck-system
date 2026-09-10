"use client";

import type { MarketingVoucherCampaign } from "@bduck/shared-types";
import { CalendarDays, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  createMarketingVoucherExportJob,
  createMarketingVoucherIdempotencyKey,
} from "@/api/marketingVoucherApi";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";

import { MarketingVoucherAppearanceSheet } from "./MarketingVoucherAppearanceSheet";
import {
  MarketingVoucherCampaignActions,
  type MarketingVoucherPermissions,
} from "./MarketingVoucherCampaignActions";
import {
  MarketingVoucherCampaignActionSheet,
  type MarketingVoucherCampaignAction,
} from "./MarketingVoucherCampaignActionSheet";
import { MarketingVoucherCampaignFormSheet } from "./MarketingVoucherCampaignFormSheet";
import { MarketingVoucherEmptyState } from "./MarketingVoucherEmptyState";
import {
  formatVoucherDateTime,
  formatVoucherNumber,
} from "./marketingVoucherFormatters";
import { MarketingVoucherStatusBadge } from "./MarketingVoucherStatusBadge";

export function MarketingVoucherCampaigns({
  campaigns,
  permissions,
}: {
  campaigns: MarketingVoucherCampaign[];
  permissions: MarketingVoucherPermissions;
}) {
  const { t, lang } = useTranslation();
  const copy = t.marketingVouchers;
  const { pendingKey, runMutation } = useMarketingVoucherMutation();
  const [search, setSearch] = useState("");
  const [formCampaign, setFormCampaign] = useState<
    MarketingVoucherCampaign | null | undefined
  >();
  const [actionCampaign, setActionCampaign] =
    useState<MarketingVoucherCampaign | null>(null);
  const [action, setAction] = useState<MarketingVoucherCampaignAction | null>(
    null,
  );
  const [appearanceCampaign, setAppearanceCampaign] =
    useState<MarketingVoucherCampaign | null>(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term
      ? campaigns.filter((campaign) =>
          campaign.name.toLocaleLowerCase().includes(term),
        )
      : campaigns;
  }, [campaigns, search]);

  const openAction = (
    campaign: MarketingVoucherCampaign,
    nextAction: MarketingVoucherCampaignAction,
  ) => {
    setActionCampaign(campaign);
    setAction(nextAction);
  };

  const exportCampaign = async (campaign: MarketingVoucherCampaign) => {
    await runMutation({
      key: `export:${campaign.id}`,
      task: () =>
        createMarketingVoucherExportJob(
          {
            campaign_id: campaign.id,
            locale: lang,
            expected_revision: campaign.revision,
            idempotency_key: createMarketingVoucherIdempotencyKey("export"),
            action_time: new Date(),
          },
          copy.toasts.error,
        ),
      messages: {
        ...copy.toasts,
        loading: copy.export.queueing,
        success: copy.export.queued,
        retry: t.common.retry,
      },
    });
  };

  const actionButtons = (campaign: MarketingVoucherCampaign) => (
    <MarketingVoucherCampaignActions
      campaign={campaign}
      permissions={permissions}
      copy={copy}
      onEdit={() => setFormCampaign(campaign)}
      onAppearance={() => setAppearanceCampaign(campaign)}
      onAction={(nextAction) => openAction(campaign, nextAction)}
      onExport={() => void exportCampaign(campaign)}
      isPending={Boolean(pendingKey)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {copy.campaigns.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatVoucherNumber(filtered.length, lang)}{" "}
            {copy.metrics.campaigns.toLocaleLowerCase()}
          </p>
        </div>
        {permissions.canWrite ? (
          <button
            type="button"
            onClick={() => setFormCampaign(null)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-400 w-fit"
          >
            <Plus size={14} />
            {copy.campaigns.create}
          </button>
        ) : null}
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-2 shadow-sm shadow-slate-200/30">
        <label className="sr-only" htmlFor="campaign-search">
          {copy.campaigns.search}
        </label>
        <input
          id="campaign-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.campaigns.search}
          className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {filtered.length === 0 ? (
        <MarketingVoucherEmptyState
          title={copy.campaigns.empty}
          description={copy.campaigns.emptyHint}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-100 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xxs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-2">{copy.campaigns.title}</th>
                  <th className="p-2">{copy.campaigns.status}</th>
                  <th className="p-2">{copy.campaigns.validity}</th>
                  <th className="p-2 text-right">
                    {copy.campaigns.codes}
                  </th>
                  <th className="p-2">{copy.campaigns.updated}</th>
                  <th className="p-2">
                    <span className="sr-only">{copy.campaigns.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-slate-50/70">
                    <td className="p-2">
                      <p className="font-semibold text-slate-950">
                        {campaign.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {copy.purpose[campaign.purpose]} ·{" "}
                        {copy.rewardType[campaign.reward_type]}
                      </p>
                    </td>
                    <td className="p-2">
                      <MarketingVoucherStatusBadge
                        status={campaign.status}
                        label={copy.campaignStatus[campaign.status]}
                      />
                    </td>
                    <td className="p-2 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={14} />
                        {campaign.valid_from} → {campaign.valid_to}
                      </span>
                    </td>
                    <td className="p-2 text-right font-semibold tabular-nums text-slate-950">
                      {formatVoucherNumber(campaign.code_counts.total, lang)}
                    </td>
                    <td className="p-2 text-xs text-slate-500">
                      {formatVoucherDateTime(campaign.updated_at, lang)}
                    </td>
                    <td className="p-2">{actionButtons(campaign)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {filtered.map((campaign) => (
              <article
                key={campaign.id}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-200/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-950 text-sm">
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {copy.purpose[campaign.purpose]} ·{" "}
                      {formatVoucherNumber(campaign.code_counts.total, lang)}{" "}
                      {copy.campaigns.codes.toLocaleLowerCase()}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <MarketingVoucherStatusBadge
                      status={campaign.status}
                      label={copy.campaignStatus[campaign.status]}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-xs text-slate-500">
                    {campaign.valid_from} → {campaign.valid_to}
                  </span>
                  {actionButtons(campaign)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <MarketingVoucherCampaignFormSheet
        isOpen={formCampaign !== undefined}
        campaign={formCampaign ?? null}
        onClose={() => setFormCampaign(undefined)}
      />
      <MarketingVoucherCampaignActionSheet
        campaign={actionCampaign}
        action={action}
        onClose={() => {
          setAction(null);
          setActionCampaign(null);
        }}
      />
      <MarketingVoucherAppearanceSheet
        campaign={appearanceCampaign}
        onClose={() => setAppearanceCampaign(null)}
      />
    </div>
  );
}
