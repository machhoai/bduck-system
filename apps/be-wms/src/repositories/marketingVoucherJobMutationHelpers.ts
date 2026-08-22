import type {
  MarketingVoucherCampaignMutationResult,
  MarketingVoucherJob,
} from "@bduck/shared-types";

import {
  campaignRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherJob,
  marketingVoucherError,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";

export type MarketingVoucherMutationPointer = {
  campaign_id: string;
  job_id: string | null;
  replayed: boolean;
};

export const loadMarketingVoucherMutationResult = async (
  pointer: MarketingVoucherMutationPointer,
): Promise<MarketingVoucherCampaignMutationResult> => {
  const [campaign, job] = await Promise.all([
    campaignRef(pointer.campaign_id).get(),
    pointer.job_id ? jobRef(pointer.job_id).get() : null,
  ]);
  if (!campaign.exists) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
      { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
      404,
    );
  }
  return {
    campaign: mapMarketingVoucherCampaign(campaign),
    job: job?.exists ? mapMarketingVoucherJob(job) : null,
    replayed: pointer.replayed,
  };
};

export const newMarketingVoucherJob = (input: {
  id: string;
  campaignId: string;
  type: MarketingVoucherJob["type"];
  generationMode: MarketingVoucherJob["generation_mode"];
  targetValidTo: MarketingVoucherJob["target_valid_to"];
  total: number;
  context: MarketingVoucherOperationContext;
  now: Date;
}): MarketingVoucherJob => ({
  id: input.id,
  type: input.type,
  status: "QUEUED",
  campaign_id: input.campaignId,
  generation_mode: input.generationMode,
  target_valid_to: input.targetValidTo,
  idempotency_key: input.context.idempotency_key,
  cursor: null,
  progress: { total: input.total, processed: 0, succeeded: 0, failed: 0 },
  requested_by: input.context.actor_id,
  last_error_code: null,
  last_error_message: null,
  output_storage_path: null,
  output_checksum: null,
  attempt_count: 0,
  completed_at: null,
  revision: 1,
  is_deleted: false,
  created_at: input.now,
  updated_at: input.now,
  action_time: input.context.action_time,
  sync_time: input.now,
});
