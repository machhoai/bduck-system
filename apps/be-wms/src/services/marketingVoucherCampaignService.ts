import type {
  ChangeMarketingVoucherCampaignStatusInput,
  CreateMarketingVoucherCampaignInput,
  ExtendMarketingVoucherCampaignInput,
  UpdateMarketingVoucherAppearanceInput,
  UpdateMarketingVoucherCampaignInput,
} from "@bduck/shared-types";

import {
  createMarketingVoucherCampaignRecord,
  updateMarketingVoucherCampaignRecord,
} from "../repositories/marketingVoucherCampaignMutationRepository.js";
import { updateMarketingVoucherAppearanceRecord } from "../repositories/marketingVoucherAppearanceRepository.js";
import {
  changeMarketingVoucherCampaignStatusRecord,
  softDeleteMarketingVoucherCampaignRecord,
} from "../repositories/marketingVoucherCampaignStatusRepository.js";
import { createMarketingVoucherExtensionJobRecord } from "../repositories/marketingVoucherExtensionJobRepository.js";
import {
  findMarketingVoucherCampaignById,
  listMarketingVoucherCampaigns,
} from "../repositories/marketingVoucherQueryRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import { assertMarketingVoucherPermission } from "./marketingVoucherAccessPolicy.js";
import {
  marketingVoucherOperationContext,
  type MarketingVoucherRequestMetadata,
} from "./marketingVoucherOperationContext.js";
import { dispatchMarketingVoucherJob } from "./marketingVoucherTaskDispatcher.js";

const requireCampaign = async (campaignId: string) => {
  const campaign = await findMarketingVoucherCampaignById(campaignId);
  if (!campaign) {
    throw {
      code: "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
      statusCode: 404,
      messages: { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
    };
  }
  return campaign;
};

const dispatchJob = async (job: { id: string; revision: number } | null) => {
  if (job)
    await dispatchMarketingVoucherJob({
      jobId: job.id,
      revision: job.revision,
    });
};

export const getMarketingVoucherCampaigns = async (
  query: { status?: string; purpose?: string; cursor?: string; limit: number },
  authorization: AuthorizationService,
) => {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.read");
  return listMarketingVoucherCampaigns(query);
};

export const getMarketingVoucherCampaign = async (
  campaignId: string,
  authorization: AuthorizationService,
) => {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.read");
  return requireCampaign(campaignId);
};

export const createMarketingVoucherCampaign = async (
  request: CreateMarketingVoucherCampaignInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.campaigns.write",
  );
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.codes.generate",
  );
  const result = await createMarketingVoucherCampaignRecord({
    campaign: request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
  await dispatchJob(result.job);
  return result;
};

export const updateMarketingVoucherCampaign = async (
  campaignId: string,
  request: UpdateMarketingVoucherCampaignInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.campaigns.write",
  );
  return updateMarketingVoucherCampaignRecord({
    campaign_id: campaignId,
    patch: request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
};

export const updateMarketingVoucherAppearance = async (
  campaignId: string,
  request: UpdateMarketingVoucherAppearanceInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.appearance.write",
  );
  return updateMarketingVoucherAppearanceRecord({
    campaign_id: campaignId,
    request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
};

export const changeMarketingVoucherCampaignStatus = async (
  campaignId: string,
  request: ChangeMarketingVoucherCampaignStatusInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.campaigns.write",
  );
  const result = await changeMarketingVoucherCampaignStatusRecord({
    campaign_id: campaignId,
    request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
  if (request.status === "ACTIVE") await dispatchJob(result.job);
  return result;
};

export const deleteMarketingVoucherCampaign = async (
  campaignId: string,
  request: {
    expected_revision: number;
    idempotency_key: string;
    action_time: Date;
  },
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.campaigns.write",
  );
  return softDeleteMarketingVoucherCampaignRecord({
    campaign_id: campaignId,
    expected_revision: request.expected_revision,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
};

export const extendMarketingVoucherCampaign = async (
  campaignId: string,
  request: ExtendMarketingVoucherCampaignInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.campaigns.extend",
  );
  const result = await createMarketingVoucherExtensionJobRecord({
    campaign_id: campaignId,
    request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
  await dispatchJob(result.job);
  return result;
};
