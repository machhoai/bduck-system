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
      className="relative aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60"
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
        <div className="flex flex-col justify-between p-4 text-slate-950 sm:p-6">
          <p className="text-[9px] font-black tracking-[0.2em] sm:text-xs">
            JPULSE · B.DUCK
          </p>
          <div>
            <p className="text-xl font-black leading-none sm:text-4xl">
              {formatVoucherReward(rewardType, rewardValue, lang)}
            </p>
            <p className="mt-2 text-[9px] font-bold uppercase tracking-wide sm:text-xs">
              {t.marketingVouchers.codes.reward}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-between p-4 sm:p-6">
          <div className="min-w-0 pr-16 sm:pr-28">
            <h3 className="truncate text-base font-black text-slate-950 sm:text-2xl">
              {campaign.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500 sm:text-sm">
              {campaign.description}
            </p>
          </div>
          <div className="absolute right-4 top-4 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100 sm:right-6 sm:top-6 sm:p-2">
            <QRCodeSVG value={voucherCode} size={72} level="M" />
          </div>
          <div>
            <p className="truncate font-mono text-sm font-black tracking-wide text-slate-950 sm:text-xl">
              {voucherCode}
            </p>
            <p className="mt-1 text-[9px] text-slate-500 sm:text-xs">
              {t.marketingVouchers.codes.validTo}: {validTo}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
