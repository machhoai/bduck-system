"use client";

import {
  MARKETING_VOUCHER_CODE_STATUSES,
  MARKETING_VOUCHER_REWARD_TYPES,
  type MarketingVoucherCampaign,
  type MarketingVoucherCodeStatus,
  type MarketingVoucherRewardType,
} from "@bduck/shared-types";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Search,
  ShieldOff,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { MarketingVoucherSkeleton } from "@/components/marketing-vouchers/MarketingVoucherSkeleton";
import { useMarketingVoucherCodes } from "@/hooks/useMarketingVoucherRealtime";
import { useTranslation } from "@/lib/i18n";
import { marketingVoucherToday } from "@/utils/marketingVoucherUi";

import { MarketingVoucherCodeResults } from "./MarketingVoucherCodeResults";
import { MarketingVoucherEmailSheet } from "./MarketingVoucherEmailSheet";
import { MarketingVoucherEmptyState } from "./MarketingVoucherEmptyState";
import { MarketingVoucherRevokeSheet } from "./MarketingVoucherRevokeSheet";

const filterClass =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";

export function MarketingVoucherCodes({
  campaigns,
  canRead,
  canRevoke,
  canEmail,
}: {
  campaigns: MarketingVoucherCampaign[];
  canRead: boolean;
  canRevoke: boolean;
  canEmail: boolean;
}) {
  const { t, lang } = useTranslation();
  const copy = t.marketingVouchers;
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState<MarketingVoucherCodeStatus | "">("");
  const [rewardType, setRewardType] = useState<MarketingVoucherRewardType | "">(
    "",
  );
  const [search, setSearch] = useState("");
  const deferredCode = useDeferredValue(search.trim().toUpperCase());
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const filters = useMemo(
    () => ({ campaignId, status, rewardType, code: deferredCode }),
    [campaignId, status, rewardType, deferredCode],
  );
  const result = useMarketingVoucherCodes({
    enabled: canRead,
    filters,
    cursor: cursors[pageIndex] ?? null,
  });
  const campaignMap = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns],
  );
  const today = marketingVoucherToday();

  useEffect(() => {
    setCursors([null]);
    setPageIndex(0);
    setSelected(new Set());
  }, [campaignId, deferredCode, rewardType, status]);

  useEffect(() => {
    const visibleIds = new Set(result.records.map((code) => code.id));
    setSelected(
      (current) => new Set([...current].filter((id) => visibleIds.has(id))),
    );
  }, [result.records]);

  const selectableIds = result.records
    .filter((code) => ["AVAILABLE", "DISTRIBUTED"].includes(code.status))
    .map((code) => code.id);
  const selectedCodes = result.records.filter((code) => selected.has(code.id));
  const selectedCampaignIds = new Set(
    selectedCodes.map((code) => code.campaign_id),
  );
  const emailCampaign =
    selectedCampaignIds.size === 1
      ? campaignMap.get([...selectedCampaignIds][0] ?? "")
      : undefined;
  const canOpenEmail =
    canEmail &&
    selectedCodes.length > 0 &&
    selectedCampaignIds.size === 1 &&
    emailCampaign?.status === "ACTIVE";
  const canOpenRevoke =
    canRevoke &&
    selectedCodes.length > 0 &&
    [...selectedCampaignIds].every((id) => {
      const campaign = campaignMap.get(id);
      return campaign?.status === "ACTIVE" && !campaign.active_export_job_id;
    });
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const nextPage = () => {
    if (!result.nextCursor) return;
    setCursors((current) => [
      ...current.slice(0, pageIndex + 1),
      result.nextCursor,
    ]);
    setPageIndex((current) => current + 1);
  };

  if (result.isLoading && result.records.length === 0)
    return <MarketingVoucherSkeleton label={copy.toasts.loading} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-950">{copy.codes.title}</h2>
        {selected.size > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {canEmail ? (
              <button
                type="button"
                disabled={!canOpenEmail}
                title={
                  selectedCampaignIds.size > 1
                    ? copy.email.oneCampaign
                    : emailCampaign?.status !== "ACTIVE"
                      ? copy.email.activeOnly
                      : undefined
                }
                onClick={() => setEmailOpen(true)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail size={14} />
                {copy.codes.email} · {selected.size}
              </button>
            ) : null}
            {canRevoke ? (
              <button
                type="button"
                disabled={!canOpenRevoke}
                title={!canOpenRevoke ? copy.codes.activeOnlyRevoke : undefined}
                onClick={() => setRevokeOpen(true)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldOff size={14} />
                {copy.codes.revoke} · {selected.size}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 rounded-xl border border-slate-100 bg-white p-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative md:col-span-2 xl:col-span-1">
          <span className="sr-only">{copy.codes.search}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400"
            size={14}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.codes.search}
            className={`${filterClass} pl-8 uppercase`}
          />
        </label>
        <select
          aria-label={copy.codes.campaign}
          className={filterClass}
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
        >
          <option value="">{copy.codes.campaign}</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.codes.status}
          className={filterClass}
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as MarketingVoucherCodeStatus | "")
          }
        >
          <option value="">{copy.codes.status}</option>
          {MARKETING_VOUCHER_CODE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {copy.codeStatus[value]}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.codes.reward}
          className={filterClass}
          value={rewardType}
          onChange={(event) =>
            setRewardType(event.target.value as MarketingVoucherRewardType | "")
          }
        >
          <option value="">{copy.codes.reward}</option>
          {MARKETING_VOUCHER_REWARD_TYPES.map((value) => (
            <option key={value} value={value}>
              {copy.rewardType[value]}
            </option>
          ))}
        </select>
      </div>

      {result.error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          {copy.loadError}
        </p>
      ) : null}
      {result.records.length === 0 ? (
        <MarketingVoucherEmptyState title={copy.codes.empty} />
      ) : (
        <MarketingVoucherCodeResults
          records={result.records}
          campaignMap={campaignMap}
          canSelect={canRevoke || canEmail}
          selected={selected}
          allSelected={allSelected}
          today={today}
          lang={lang}
          copy={copy}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
        />
      )}
      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
        <button
          type="button"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((current) => current - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          {copy.codes.previous}
        </button>
        <span className="text-xs font-semibold text-slate-600">
          {copy.codes.page} {pageIndex + 1}
        </span>
        <button
          type="button"
          disabled={!result.nextCursor}
          onClick={nextPage}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {copy.codes.next}
          <ChevronRight size={14} />
        </button>
      </div>
      {revokeOpen ? (
        <MarketingVoucherRevokeSheet
          codeIds={[...selected]}
          onClose={() => setRevokeOpen(false)}
          onSuccess={() => setSelected(new Set())}
        />
      ) : null}
      {emailOpen && emailCampaign && selectedCodes.length > 0 ? (
        <MarketingVoucherEmailSheet
          campaign={emailCampaign}
          codes={selectedCodes}
          onClose={() => setEmailOpen(false)}
          onSuccess={() => setSelected(new Set())}
        />
      ) : null}
    </div>
  );
}
