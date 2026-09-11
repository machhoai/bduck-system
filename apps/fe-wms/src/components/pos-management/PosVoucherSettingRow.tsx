"use client";

import type {
  PosProductVisibilityCatalogItem,
  PosVoucherCampaignOption,
  PosVoucherCampaignSetting,
} from "@bduck/shared-types";
import { useState } from "react";

interface Props {
  campaign: PosVoucherCampaignOption;
  setting?: PosVoucherCampaignSetting;
  products: PosProductVisibilityCatalogItem[];
  disabled: boolean;
  labels: {
    active: string;
    inactive: string;
    product: string;
    quantity: string;
    percentEntireOrder: string;
    freeTicket: string;
    freeItem: string;
    save: string;
  };
  onSave: (value: {
    enabled: boolean;
    productId: string;
    quantity: number;
  }) => void;
}

const rewardLabel = (
  campaign: PosVoucherCampaignOption,
  labels: Props["labels"],
): string => {
  if (campaign.reward_type === "FREE_TICKET") return labels.freeTicket;
  if (campaign.reward_type === "FREE_ITEM") return labels.freeItem;
  return `Giảm ${campaign.reward_value}%`;
};

export function PosVoucherSettingRow({
  campaign,
  setting,
  products,
  disabled,
  labels,
  onSave,
}: Props) {
  const [enabled, setEnabled] = useState(setting?.enabled ?? false);
  const [productId, setProductId] = useState(setting?.product_id ?? "");
  const [quantity, setQuantity] = useState(setting?.quantity ?? 1);
  const canSave = Boolean(productId) && quantity > 0 && !disabled;

  return (
    <article className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(220px,1fr)_minmax(240px,1.2fr)_90px_90px] lg:items-end">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-slate-900">
            {campaign.name}
          </span>
          <span className="rounded-md bg-amber-50 px-2 py-1 text-xxs font-bold text-amber-700">
            {rewardLabel(campaign, labels)}
          </span>
        </div>
        <p className="mt-1 text-xxs text-slate-500">
          {campaign.valid_from} – {campaign.valid_to}
        </p>
        {campaign.reward_type === "DISCOUNT_PERCENT" ? (
          <p className="mt-1 text-xxs font-semibold text-sky-700">
            {labels.percentEntireOrder}
          </p>
        ) : null}
      </div>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        {labels.product}
        <select
          value={productId}
          disabled={disabled}
          onChange={(event) => setProductId(event.target.value)}
          className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900 outline-none focus:border-amber-400"
        >
          <option value="">—</option>
          {products.map((product) => (
            <option key={product.goods_id} value={product.goods_id}>
              {product.goods_name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        {labels.quantity}
        <input
          type="number"
          min={1}
          max={999}
          value={quantity}
          disabled={disabled}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="h-8 rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none focus:border-amber-400"
        />
      </label>
      <div className="flex items-center gap-2 lg:grid">
        <button
          type="button"
          aria-pressed={enabled}
          disabled={disabled}
          onClick={() => setEnabled((value) => !value)}
          className={`h-8 rounded-lg px-3 text-xs font-bold ${
            enabled
              ? "bg-lime-100 text-lime-800"
              : "bg-slate-100 text-slate-600"
          } disabled:opacity-50`}
        >
          {enabled ? labels.active : labels.inactive}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave({ enabled, productId, quantity })}
          className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {labels.save}
        </button>
      </div>
    </article>
  );
}
