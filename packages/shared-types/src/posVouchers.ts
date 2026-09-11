import type {
  ISOTimestamped,
  LocalDate,
  SoftDeletable,
} from "./utility.js";
import type {
  MarketingVoucherCampaignStatus,
  MarketingVoucherRewardType,
} from "./marketingVouchers.js";
import type { PosProductVisibilityCatalogItem } from "./pos.js";

export const POS_VOUCHER_CAMPAIGN_SETTINGS_COLLECTION =
  "pos_voucher_campaign_settings" as const;
export const POS_VOUCHER_REDEMPTIONS_COLLECTION =
  "pos_voucher_redemptions" as const;

export interface PosVoucherCampaignSetting
  extends SoftDeletable,
    ISOTimestamped {
  id: string;
  warehouse_id: string;
  campaign_id: string;
  enabled: boolean;
  product_id: string;
  quantity: number;
  version: number;
  updated_by: string;
}

export interface PosVoucherCampaignOption {
  id: string;
  name: string;
  reward_type: MarketingVoucherRewardType;
  reward_value: number;
  valid_from: LocalDate;
  valid_to: LocalDate;
  status: MarketingVoucherCampaignStatus;
}

export interface PosVoucherSettingsView {
  campaigns: PosVoucherCampaignOption[];
  products: PosProductVisibilityCatalogItem[];
  settings: PosVoucherCampaignSetting[];
}

export interface PosVoucherCampaignSettingInput {
  enabled: boolean;
  product_id: string;
  quantity: number;
  expected_version: number;
  action_time: string;
}

export type PosVoucherRedemptionStatus = "RESERVED" | "COMPLETED" | "CANCELLED";

export interface PosVoucherRedemption extends ISOTimestamped, SoftDeletable {
  id: string;
  voucher_code: string;
  campaign_id: string;
  warehouse_id: string;
  device_id: string;
  order_id: string;
  staff_id: string;
  reward_type: MarketingVoucherRewardType;
  reward_value: number;
  product_id: string;
  quantity: number;
  discount_amount: number;
  status: PosVoucherRedemptionStatus;
  expires_at?: Date | null;
  cancelled_at?: Date | null;
  action_time: Date;
  sync_time: Date;
}
