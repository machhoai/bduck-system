import type { MarketingVoucherCampaign } from "@bduck/shared-types";
import {
  Ban,
  CalendarDays,
  CircleCheckBig,
  Gift,
  Hash,
  TicketCheck,
} from "lucide-react";

import type { Dictionary } from "@/lib/i18n/vi";
import { summarizeMarketingVoucherCampaign } from "@/utils/marketingVoucherCampaignMetrics";

import { formatVoucherNumber } from "./marketingVoucherFormatters";
import { MarketingVoucherStatusBadge } from "./MarketingVoucherStatusBadge";

const healthStyles = {
  HEALTHY: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  LOW: "bg-amber-50 text-amber-800 ring-amber-200",
  EMPTY: "bg-rose-50 text-rose-800 ring-rose-200",
} as const;

function RatioRing({
  label,
  hint,
  value,
  detail,
  tone,
}: {
  label: string;
  hint: string;
  value: number;
  detail: string;
  tone: "amber" | "emerald" | "sky";
}) {
  const stroke = {
    amber: "stroke-amber-500",
    emerald: "stroke-emerald-500",
    sky: "stroke-sky-500",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3">
      <div
        className="relative h-12 w-12 shrink-0"
        role="img"
        aria-label={`${label}: ${value}%`}
      >
        <svg className="h-full w-full -rotate-90" viewBox="0 0 42 42">
          <circle
            cx="21"
            cy="21"
            r="17"
            fill="none"
            strokeWidth="4"
            className="stroke-slate-200"
          />
          <circle
            cx="21"
            cy="21"
            r="17"
            fill="none"
            pathLength="100"
            strokeDasharray={`${value} 100`}
            strokeLinecap="round"
            strokeWidth="4"
            className={stroke}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums text-slate-950">
          {value}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-950">
          {detail}
        </p>
      </div>
    </div>
  );
}

export function MarketingVoucherCampaignHealth({
  campaign,
  copy,
  lang,
}: {
  campaign: MarketingVoucherCampaign;
  copy: Dictionary["marketingVouchers"];
  lang: string;
}) {
  const summary = summarizeMarketingVoucherCampaign(campaign);
  const format = (value: number) => formatVoucherNumber(value, lang);
  const primaryMetrics = [
    {
      label: copy.overview.total,
      value: summary.total,
      hint: copy.overview.actualCodes,
      icon: Hash,
      style: "bg-amber-100 text-amber-800",
    },
    {
      label: copy.overview.issued,
      value: summary.issued,
      hint: `${summary.issuedRate}% ${copy.overview.ofInventory}`,
      icon: Gift,
      style: "bg-orange-100 text-orange-800",
    },
    {
      label: copy.overview.remaining,
      value: summary.available,
      hint: `${summary.availabilityRate}% ${copy.overview.availableHint}`,
      icon: TicketCheck,
      style: "bg-sky-100 text-sky-800",
    },
    {
      label: copy.overview.used,
      value: summary.used,
      hint: `${summary.usageRate}% ${copy.overview.afterIssue}`,
      icon: CircleCheckBig,
      style: "bg-emerald-100 text-emerald-800",
    },
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 shadow-sm shadow-slate-200/40">
      <header className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-950">
              {campaign.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays aria-hidden="true" size={14} />
              <span>{campaign.valid_from}</span>
              <span aria-hidden="true">→</span>
              <span>{campaign.valid_to}</span>
            </p>
          </div>
          <MarketingVoucherStatusBadge
            status={campaign.status}
            label={copy.campaignStatus[campaign.status]}
          />
        </div>
      </header>

      <div className="space-y-3 p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map(({ label, value, hint, icon: Icon, style }) => (
            <div
              key={label}
              className="rounded-lg border border-slate-100 bg-white p-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg ${style}`}
                >
                  <Icon aria-hidden="true" size={16} />
                </span>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
              </div>
              <p className="mt-2 text-lg font-bold tabular-nums text-slate-950">
                {format(value)}
              </p>
              <p className="text-xxs font-medium text-slate-400">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <RatioRing
            label={copy.overview.issuedRate}
            hint={copy.overview.issuedRateHint}
            value={summary.issuedRate}
            detail={`${format(summary.issued)}/${format(summary.total)}`}
            tone="amber"
          />
          <RatioRing
            label={copy.overview.usageRate}
            hint={copy.overview.usageRateHint}
            value={summary.usageRate}
            detail={`${format(summary.used)}/${format(summary.issued)}`}
            tone="emerald"
          />
          <RatioRing
            label={copy.overview.availabilityRate}
            hint={copy.overview.availabilityRateHint}
            value={summary.availabilityRate}
            detail={`${format(summary.available)}/${format(summary.total)}`}
            tone="sky"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CampaignFact
            label={copy.overview.distributedUnused}
            value={format(summary.distributedUnused)}
          />
          <CampaignFact
            label={copy.overview.revoked}
            value={format(summary.revoked)}
            tone="rose"
          />
          <CampaignFact
            label={copy.overview.duration}
            value={`${format(summary.durationDays)} ${copy.overview.days}`}
          />
          <div
            className={`rounded-lg px-3 py-2 ring-1 ring-inset ${healthStyles[summary.inventoryHealth]}`}
          >
            <p className="text-xxs font-semibold uppercase tracking-wider">
              {copy.overview.inventoryStatus}
            </p>
            <p className="mt-1 text-sm font-bold">
              {copy.overview.health[summary.inventoryHealth]}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function CampaignFact({
  label,
  value,
  tone = "amber",
}: {
  label: string;
  value: string;
  tone?: "amber" | "rose";
}) {
  const styles =
    tone === "rose"
      ? "bg-rose-50 text-rose-800"
      : "bg-amber-50 text-amber-800";
  const Icon = tone === "rose" ? Ban : TicketCheck;

  return (
    <div className={`rounded-lg px-3 py-2 ${styles}`}>
      <p className="flex items-center gap-1 text-xxs font-semibold uppercase tracking-wider">
        <Icon aria-hidden="true" size={12} />
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
