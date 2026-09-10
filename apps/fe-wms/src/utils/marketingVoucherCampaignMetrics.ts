import type { MarketingVoucherCampaign } from "@bduck/shared-types";

export type MarketingVoucherInventoryHealth = "HEALTHY" | "LOW" | "EMPTY";

type CampaignMetricSource = Pick<
  MarketingVoucherCampaign,
  "code_counts" | "valid_from" | "valid_to"
>;

const percentage = (value: number, total: number) =>
  total <= 0
    ? 0
    : Math.min(100, Math.max(0, Math.round((value / total) * 100)));

const dateToUtcMilliseconds = (value: string) =>
  Date.parse(`${value}T00:00:00.000Z`);

export const summarizeMarketingVoucherCampaign = (
  campaign: CampaignMetricSource,
) => {
  const total = Math.max(0, campaign.code_counts.total);
  const available = Math.max(0, campaign.code_counts.available);
  const distributedUnused = Math.max(0, campaign.code_counts.distributed);
  const used = Math.max(0, campaign.code_counts.used);
  const revoked = Math.max(0, campaign.code_counts.revoked);
  const issued = distributedUnused + used;
  const availabilityRate = percentage(available, total);
  const inventoryHealth: MarketingVoucherInventoryHealth =
    available === 0 ? "EMPTY" : availabilityRate <= 10 ? "LOW" : "HEALTHY";
  const durationMilliseconds =
    dateToUtcMilliseconds(campaign.valid_to) -
    dateToUtcMilliseconds(campaign.valid_from);

  return {
    total,
    available,
    distributedUnused,
    used,
    revoked,
    issued,
    issuedRate: percentage(issued, total),
    usageRate: percentage(used, issued),
    availabilityRate,
    inventoryHealth,
    durationDays: Math.max(
      0,
      Math.floor(durationMilliseconds / 86_400_000) + 1,
    ),
  };
};
