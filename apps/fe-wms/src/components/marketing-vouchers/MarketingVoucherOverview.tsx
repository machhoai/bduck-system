"use client";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherJob,
} from "@bduck/shared-types";
import { Activity, CircleCheckBig, Layers3, TicketCheck } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import {
  marketingVoucherJobProgress,
  summarizeMarketingVoucherCampaigns,
} from "@/utils/marketingVoucherUi";

import { MarketingVoucherCampaignHealth } from "./MarketingVoucherCampaignHealth";
import { formatVoucherNumber } from "./marketingVoucherFormatters";
import { MarketingVoucherStatusBadge } from "./MarketingVoucherStatusBadge";

export function MarketingVoucherOverview({
  campaigns,
  jobs,
}: {
  campaigns: MarketingVoucherCampaign[];
  jobs: MarketingVoucherJob[];
}) {
  const { t, lang } = useTranslation();
  const copy = t.marketingVouchers;
  const summary = summarizeMarketingVoucherCampaigns(campaigns, jobs);
  const metrics = [
    { label: copy.metrics.campaigns, value: summary.campaigns, icon: Layers3 },
    {
      label: copy.metrics.activeCampaigns,
      value: summary.activeCampaigns,
      icon: Activity,
    },
    {
      label: copy.metrics.totalCodes,
      value: summary.totalCodes,
      icon: TicketCheck,
    },
    {
      label: copy.metrics.activeJobs,
      value: summary.activeJobs,
      icon: CircleCheckBig,
    },
  ];
  const lifecycle = [
    [copy.metrics.available, summary.available],
    [copy.metrics.distributed, summary.distributed],
    [copy.metrics.used, summary.used],
    [copy.metrics.revoked, summary.revoked],
  ] as const;
  const activeJobs = jobs.filter((job) =>
    ["QUEUED", "PROCESSING", "PAUSED"].includes(job.status),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-200/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <Icon aria-hidden="true" size={14} />
              </span>
            </div>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {formatVoucherNumber(value, lang)}
            </p>
          </article>
        ))}
      </div>

      <section aria-labelledby="campaign-health-title" className="space-y-3">
        <div>
          <h2
            id="campaign-health-title"
            className="text-base font-semibold text-slate-950"
          >
            {copy.overview.campaignHealthTitle}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {copy.overview.campaignHealthHint}
          </p>
        </div>
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
            {copy.overview.noCampaigns}
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <MarketingVoucherCampaignHealth
                key={campaign.id}
                campaign={campaign}
                copy={copy}
                lang={lang}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-5">
        <section className="rounded-xl border border-slate-100 bg-white p-3 xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-950">
            {copy.overview.lifecycle}
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {lifecycle.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between py-2"
              >
                <span className="text-xs text-slate-600">{label}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-950">
                  {formatVoucherNumber(value, lang)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-3 xl:col-span-3">
          <h2 className="text-sm font-semibold text-slate-950">
            {copy.overview.runningJobs}
          </h2>
          <div className="mt-3 space-y-3">
            {activeJobs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                {copy.overview.noRunningJobs}
              </p>
            ) : (
              activeJobs.slice(0, 5).map((job) => {
                const progress = marketingVoucherJobProgress(job);
                return (
                  <div key={job.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {campaigns.find(
                            (campaign) => campaign.id === job.campaign_id,
                          )?.name ?? job.campaign_id}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {copy.jobType[job.type]}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <MarketingVoucherStatusBadge
                          status={job.status}
                          label={copy.jobStatus[job.status]}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <progress
                        className="h-1.5 flex-1 accent-amber-500"
                        max={100}
                        value={progress}
                      />
                      <span className="text-xs font-semibold tabular-nums text-slate-700">
                        {progress}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
