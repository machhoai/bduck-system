"use client";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherJob,
  MarketingVoucherJobItem,
} from "@bduck/shared-types";
import { RotateCcw } from "lucide-react";

import {
  createMarketingVoucherIdempotencyKey,
  retryMarketingVoucherEmailItems,
} from "@/api/marketingVoucherApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useMarketingVoucherJobItems } from "@/hooks/useMarketingVoucherRealtime";
import { useTranslation } from "@/lib/i18n";

import { MarketingVoucherEmptyState } from "./MarketingVoucherEmptyState";
import { MarketingVoucherSkeleton } from "./MarketingVoucherSkeleton";

const statusClass: Record<MarketingVoucherJobItem["status"], string> = {
  QUEUED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-sky-50 text-sky-700",
  SUCCEEDED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export function MarketingVoucherEmailResultsSheet({
  job,
  campaign,
  canEmail,
  onClose,
}: {
  job: MarketingVoucherJob;
  campaign: MarketingVoucherCampaign | undefined;
  canEmail: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const result = useMarketingVoucherJobItems(true, job.id);
  const { isPending, runMutation } = useMarketingVoucherMutation();
  const failedItems = result.records.filter((item) => item.status === "FAILED");
  const succeededItems = result.records.filter(
    (item) => item.status === "SUCCEEDED",
  );
  const voucherCount = (items: MarketingVoucherJobItem[]) =>
    items.reduce((total, item) => total + item.voucher_code_ids.length, 0);
  const retryFailed = async () => {
    if (failedItems.length === 0) return;
    await runMutation({
      key: `email-retry:${job.id}`,
      task: () =>
        retryMarketingVoucherEmailItems(
          job.id,
          {
            job_id: job.id,
            item_ids: failedItems.map((item) => item.id),
            idempotency_key:
              createMarketingVoucherIdempotencyKey("email-retry"),
            action_time: new Date(),
          },
          copy.toasts.error,
        ),
      messages: { ...copy.toasts, retry: t.common.retry },
    });
  };

  return (
    <BottomSheet
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      defaultSnap="full"
      title={copy.emailResults.title}
      desktopClassName="md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[720px] md:rounded-none md:border-0"
      contentClassName="flex-1 overflow-y-auto px-5 pb-8 md:px-7"
    >
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [
              copy.emailResults.emails,
              succeededItems.length,
              "text-emerald-700",
            ],
            [copy.emailResults.failed, failedItems.length, "text-rose-700"],
            [
              copy.emailResults.vouchers,
              voucherCount(succeededItems),
              "text-emerald-700",
            ],
            [
              copy.emailResults.failed,
              voucherCount(failedItems),
              "text-rose-700",
            ],
          ].map(([label, value, tone], index) => (
            <div
              key={`${label}-${index}`}
              className="rounded-xl border border-slate-100 bg-white p-3"
            >
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className={`mt-1 text-base font-bold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
        {failedItems.length > 0 && canEmail ? (
          <button
            type="button"
            disabled={isPending || campaign?.status !== "ACTIVE"}
            onClick={() => void retryFailed()}
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={14} />
            {copy.emailResults.retryFailed} · {failedItems.length}
          </button>
        ) : null}
        {result.error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
          >
            {copy.loadError}
          </p>
        ) : result.isLoading && result.records.length === 0 ? (
          <MarketingVoucherSkeleton label={copy.toasts.loading} />
        ) : result.records.length === 0 ? (
          <MarketingVoucherEmptyState title={copy.emailResults.noItems} />
        ) : (
          <div className="space-y-2">
            {result.records.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-100 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {item.recipient_email ?? "—"}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">
                      {item.voucher_code_ids.join(", ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${statusClass[item.status]}`}
                  >
                    {copy.jobItemStatus[item.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {copy.emailResults.attempts}: {item.attempt_count}
                </p>
                {item.last_error_message ? (
                  <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                    {item.last_error_code ? `${item.last_error_code}: ` : ""}
                    {item.last_error_message}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
