"use client";

import {
  Activity,
  BriefcaseBusiness,
  LayoutDashboard,
  Tags,
  Ticket,
} from "lucide-react";
import { useState } from "react";

import {
  useMarketingVoucherCampaigns,
  useMarketingVoucherJobs,
} from "@/hooks/useMarketingVoucherRealtime";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { marketingVoucherPermissionGranted } from "@/utils/marketingVoucherUi";

import { MarketingVoucherCampaigns } from "./MarketingVoucherCampaigns";
import { MarketingVoucherCodes } from "./MarketingVoucherCodes";
import { MarketingVoucherJobs } from "./MarketingVoucherJobs";
import { MarketingVoucherOverview } from "./MarketingVoucherOverview";
import { MarketingVoucherSkeleton } from "./MarketingVoucherSkeleton";

type VoucherTab = "overview" | "campaigns" | "codes" | "jobs";

export function MarketingVoucherWorkspace() {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const [activeTab, setActiveTab] = useState<VoucherTab>("overview");
  const hasPermission = useUserStore((state) => state.hasPermission);
  const workplaceId = useUserStore(
    (state) => state.user?.workplace_facility_id,
  );
  const permitted = (
    permission: Parameters<typeof marketingVoucherPermissionGranted>[2],
  ) =>
    marketingVoucherPermissionGranted(hasPermission, workplaceId, permission);
  const permissions = {
    canRead: permitted("marketing_vouchers.read"),
    canWrite: permitted("marketing_vouchers.campaigns.write"),
    canGenerate: permitted("marketing_vouchers.codes.generate"),
    canRevoke: permitted("marketing_vouchers.codes.revoke"),
    canExtend: permitted("marketing_vouchers.campaigns.extend"),
    canAppearance: permitted("marketing_vouchers.appearance.write"),
    canEmail: permitted("marketing_vouchers.email.send"),
  };
  const campaigns = useMarketingVoucherCampaigns(permissions.canRead);
  const jobs = useMarketingVoucherJobs(permissions.canRead);
  const tabs: {
    id: VoucherTab;
    label: string;
    icon: typeof LayoutDashboard;
  }[] = [
    { id: "overview", label: copy.tabs.overview, icon: LayoutDashboard },
    { id: "campaigns", label: copy.tabs.campaigns, icon: Tags },
    { id: "codes", label: copy.tabs.codes, icon: Ticket },
    { id: "jobs", label: copy.tabs.jobs, icon: BriefcaseBusiness },
  ];
  const initialLoading =
    (campaigns.isLoading && campaigns.records.length === 0) ||
    (jobs.isLoading && jobs.records.length === 0);
  const hasError = campaigns.error || jobs.error;
  const fromCache = campaigns.isFromCache || jobs.isFromCache;

  return (
    <main className="min-h-full bg-slate-50/70 px-3 pb-28 pt-4 sm:px-5 lg:px-7 lg:pb-8 lg:pt-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500 text-slate-950 shadow-sm">
                  <Ticket aria-hidden="true" size={22} />
                </span>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {copy.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    {copy.subtitle}
                  </p>
                </div>
              </div>
            </div>
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${fromCache ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${fromCache ? "bg-amber-500" : "bg-emerald-500"}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${fromCache ? "bg-amber-600" : "bg-emerald-600"}`}
                />
              </span>
              {fromCache ? copy.cached : copy.realtime}
            </div>
          </div>
        </header>

        <nav
          aria-label={copy.title}
          className="sticky top-0 z-20 -mx-3 mt-4 overflow-x-auto border-y border-slate-100 bg-white/95 px-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border"
        >
          <div className="flex min-w-max gap-1 p-1.5">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={activeTab === id ? "page" : undefined}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === id ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </nav>

        <section className="mt-5">
          {hasError ? (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            >
              <Activity size={17} />
              {copy.loadError}
            </div>
          ) : null}
          {initialLoading ? (
            <MarketingVoucherSkeleton label={copy.toasts.loading} />
          ) : null}
          {!initialLoading && activeTab === "overview" ? (
            <MarketingVoucherOverview
              campaigns={campaigns.records}
              jobs={jobs.records}
            />
          ) : null}
          {!initialLoading && activeTab === "campaigns" ? (
            <MarketingVoucherCampaigns
              campaigns={campaigns.records}
              permissions={permissions}
            />
          ) : null}
          {!initialLoading && activeTab === "codes" ? (
            <MarketingVoucherCodes
              campaigns={campaigns.records}
              canRead={permissions.canRead}
              canRevoke={permissions.canRevoke}
              canEmail={permissions.canEmail}
            />
          ) : null}
          {!initialLoading && activeTab === "jobs" ? (
            <MarketingVoucherJobs
              jobs={jobs.records}
              campaigns={campaigns.records}
              canGenerate={permissions.canGenerate}
              canExtend={permissions.canExtend}
              canEmail={permissions.canEmail}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
