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
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <Icon aria-hidden="true" size={18} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              {formatVoucherNumber(value, lang)}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 xl:col-span-2">
          <h2 className="text-base font-bold text-slate-950">
            {copy.overview.lifecycle}
          </h2>
          <div className="mt-5 divide-y divide-slate-100">
            {lifecycle.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between py-3"
              >
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-bold tabular-nums text-slate-950">
                  {formatVoucherNumber(value, lang)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 xl:col-span-3">
          <h2 className="text-base font-bold text-slate-950">
            {copy.overview.runningJobs}
          </h2>
          <div className="mt-5 space-y-4">
            {activeJobs.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {copy.overview.noRunningJobs}
              </p>
            ) : (
              activeJobs.slice(0, 5).map((job) => {
                const progress = marketingVoucherJobProgress(job);
                return (
                  <div key={job.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {campaigns.find(
                            (campaign) => campaign.id === job.campaign_id,
                          )?.name ?? job.campaign_id}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {copy.jobType[job.type]}
                        </p>
                      </div>
                      <MarketingVoucherStatusBadge
                        status={job.status}
                        label={copy.jobStatus[job.status]}
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <progress
                        className="h-2 flex-1 accent-amber-500"
                        max={100}
                        value={progress}
                      />
                      <span className="text-xs font-bold tabular-nums text-slate-700">
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
