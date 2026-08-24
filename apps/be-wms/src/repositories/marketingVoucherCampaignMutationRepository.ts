import { randomUUID } from "node:crypto";

import {
  AuditAction,
  type CreateMarketingVoucherCampaignInput,
  type MarketingVoucherCampaign,
  type MarketingVoucherCampaignMutationResult,
  type MarketingVoucherJob,
  type UpdateMarketingVoucherCampaignInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherJob,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";
import {
  assertCampaignMutable,
  assertMarketingVoucherRevision,
} from "./marketingVoucherRepositoryGuards.js";

const emptyCounts = () => ({
  available: 0,
  distributed: 0,
  used: 0,
  revoked: 0,
  total: 0,
});

const loadMutationResult = async (
  campaignId: string,
  jobId: string | null,
  replayed: boolean,
): Promise<MarketingVoucherCampaignMutationResult> => {
  const [campaignSnapshot, jobSnapshot] = await Promise.all([
    campaignRef(campaignId).get(),
    jobId ? jobRef(jobId).get() : null,
  ]);
  if (!campaignSnapshot.exists) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
      { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
      404,
    );
  }
  return {
    campaign: mapMarketingVoucherCampaign(campaignSnapshot),
    job: jobSnapshot?.exists ? mapMarketingVoucherJob(jobSnapshot) : null,
    replayed,
  };
};

export const createMarketingVoucherCampaignRecord = async (input: {
  campaign: CreateMarketingVoucherCampaignInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const campaignId = randomUUID();
  const jobId = randomUUID();
  const result = await db.runTransaction<{
    campaign_id: string;
    job_id: string | null;
    replayed: boolean;
  }>(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "CREATE_CAMPAIGN",
      input.context,
      input.campaign,
    );
    if (operation.replay) {
      return { ...operation.replay, replayed: true } as {
        campaign_id: string;
        job_id: string | null;
        replayed: boolean;
      };
    }

    const now = new Date();
    const campaign: MarketingVoucherCampaign = {
      id: campaignId,
      name: input.campaign.name,
      description: input.campaign.description,
      reward_type: input.campaign.reward_type,
      reward_value: input.campaign.reward_value,
      valid_from: input.campaign.valid_from,
      valid_to: input.campaign.valid_to,
      prefix: input.campaign.prefix.toUpperCase(),
      code_length: input.campaign.code_length,
      suffix: input.campaign.suffix.toUpperCase(),
      purpose: input.campaign.purpose,
      status: "GENERATING",
      accent_color: input.campaign.accent_color.toUpperCase(),
      image_storage_path: null,
      image_url: null,
      code_counts: emptyCounts(),
      total_issued: 0,
      active_generation_job_id: jobId,
      active_extension_job_id: null,
      revision: 1,
      created_by: input.context.actor_id,
      updated_by: input.context.actor_id,
      legacy_metadata: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const job: MarketingVoucherJob = {
      id: jobId,
      type: "GENERATE_CODES",
      status: "QUEUED",
      campaign_id: campaignId,
      generation_mode: "INITIAL",
      target_valid_to: null,
      email_subject: null,
      email_introduction: null,
      idempotency_key: input.context.idempotency_key,
      cursor: null,
      progress: {
        total: input.campaign.requested_code_count,
        processed: 0,
        succeeded: 0,
        failed: 0,
      },
      requested_by: input.context.actor_id,
      last_error_code: null,
      last_error_message: null,
      output_storage_path: null,
      output_checksum: null,
      attempt_count: 0,
      completed_at: null,
      revision: 1,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const operationResult = { campaign_id: campaignId, job_id: jobId };
    transaction.create(campaignRef(campaignId), campaign);
    transaction.create(jobRef(jobId), job);
    writeMarketingVoucherAudit(transaction, {
      id: `${operation.id}:create`,
      action: AuditAction.MARKETING_VOUCHER_CAMPAIGN_CREATE,
      entity_type: "marketing_voucher_campaigns",
      entity_id: campaignId,
      entity_name: campaign.name,
      context: input.context,
      old_value: null,
      new_value: campaign,
      sync_time: now,
      notes: "Marketing voucher campaign created with initial generation job",
    });
    writeMarketingVoucherOperation(
      transaction,
      operation,
      "CREATE_CAMPAIGN",
      input.context,
      operationResult,
      now,
    );
    return { ...operationResult, replayed: false };
  });
  return loadMutationResult(
    String(result.campaign_id),
    String(result.job_id),
    result.replayed === true,
  );
};

export const updateMarketingVoucherCampaignRecord = async (input: {
  campaign_id: string;
  patch: UpdateMarketingVoucherCampaignInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const result = await db.runTransaction<{
    campaign_id: string;
    job_id: string | null;
    replayed: boolean;
  }>(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "UPDATE_CAMPAIGN",
      input.context,
      { campaign_id: input.campaign_id, patch: input.patch },
    );
    if (operation.replay) {
      return { ...operation.replay, replayed: true } as {
        campaign_id: string;
        job_id: string | null;
        replayed: boolean;
      };
    }
    const ref = campaignRef(input.campaign_id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("is_deleted") === true) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
        { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
        404,
      );
    }
    const previous = mapMarketingVoucherCampaign(snapshot);
    assertMarketingVoucherRevision(
      previous.revision,
      input.patch.expected_revision,
    );
    assertCampaignMutable(previous);
    if (
      input.patch.valid_to !== undefined &&
      input.patch.valid_to !== previous.valid_to &&
      previous.total_issued > 0
    ) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_USE_EXTEND_OPERATION",
        {
          vi: "Chiến dịch đã có mã. Hãy dùng chức năng gia hạn để đổi ngày hết hạn.",
          zh: "活动已有券码，请使用延期功能修改到期日。",
        },
        409,
      );
    }
    const {
      expected_revision: _revision,
      idempotency_key: _idempotencyKey,
      action_time: _actionTime,
      ...patch
    } = input.patch;
    const now = new Date();
    const updated: MarketingVoucherCampaign = {
      ...previous,
      ...patch,
      revision: previous.revision + 1,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    if (updated.valid_from > updated.valid_to) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_DATE_RANGE_INVALID",
        {
          vi: "Khoảng ngày chiến dịch không hợp lệ.",
          zh: "活动日期范围无效。",
        },
        400,
      );
    }
    if (
      updated.reward_type === "DISCOUNT_PERCENT" &&
      (updated.reward_value <= 0 || updated.reward_value > 100)
    ) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_REWARD_VALUE_INVALID",
        {
          vi: "Phần trăm giảm giá phải lớn hơn 0 và không vượt quá 100.",
          zh: "折扣百分比必须大于 0 且不超过 100。",
        },
        400,
      );
    }
    const operationResult = { campaign_id: updated.id, job_id: null };
    transaction.set(ref, updated);
    writeMarketingVoucherAudit(transaction, {
      id: `${operation.id}:update`,
      action: AuditAction.MARKETING_VOUCHER_CAMPAIGN_UPDATE,
      entity_type: "marketing_voucher_campaigns",
      entity_id: updated.id,
      entity_name: updated.name,
      context: input.context,
      old_value: previous,
      new_value: updated,
      sync_time: now,
      notes: "Marketing voucher campaign updated",
    });
    writeMarketingVoucherOperation(
      transaction,
      operation,
      "UPDATE_CAMPAIGN",
      input.context,
      operationResult,
      now,
    );
    return { ...operationResult, replayed: false };
  });
  return loadMutationResult(
    String(result.campaign_id),
    null,
    result.replayed === true,
  );
};
