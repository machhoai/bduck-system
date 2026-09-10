"use client";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";
import { QRCodeSVG } from "qrcode.react";

import { useTranslation } from "@/lib/i18n";

import { formatVoucherReward } from "./marketingVoucherFormatters";

export function MarketingVoucherPreview({
  campaign,
  code,
  accentColor,
}: {
  campaign: MarketingVoucherCampaign;
  code?: MarketingVoucherCode;
  accentColor?: string;
}) {
  const { t, lang } = useTranslation();
  const voucherCode = code?.id ?? "JPULSE-DEMO";
  const rewardType = code?.reward_type ?? campaign.reward_type;
  const rewardValue = code?.reward_value ?? campaign.reward_value;
  const validTo = code?.valid_to ?? campaign.valid_to;
  const color = accentColor ?? campaign.accent_color;

  return (
    <div
      aria-label={`${campaign.name} ${voucherCode}`}
      className="relative aspect-[21/9] w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-y-0 left-0 h-full w-[34%]"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <rect width="100" height="100" fill={color} />
      </svg>
      <div className="relative grid h-full grid-cols-[34%_1fr]">
        <div className="flex flex-col justify-between p-3 text-slate-950 sm:p-4">
          <p className="text-[8px] font-bold tracking-widest sm:text-[10px]">
            JPULSE · B.DUCK
          </p>
          <div>
            <p className="text-base font-bold leading-none sm:text-xl">
              {formatVoucherReward(rewardType, rewardValue, lang)}
            </p>
            <p className="mt-1 text-[8px] font-semibold uppercase tracking-wide sm:text-[10px]">
              {t.marketingVouchers.codes.reward}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-between p-3 sm:p-4">
          <div className="min-w-0 pr-12 sm:pr-20">
            <h3 className="truncate text-sm font-bold text-slate-950 sm:text-base">
              {campaign.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500 sm:text-xs">
              {campaign.description}
            </p>
          </div>
          <div className="absolute right-3 top-3 rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-slate-100 sm:right-4 sm:top-4">
            <QRCodeSVG value={voucherCode} size={48} level="M" />
          </div>
          <div>
            <p className="truncate font-mono text-xs font-bold tracking-wide text-slate-950 sm:text-sm">
              {voucherCode}
            </p>
            <p className="mt-0.5 text-[8px] text-slate-500 sm:text-[10px]">
              {t.marketingVouchers.codes.validTo}: {validTo}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
