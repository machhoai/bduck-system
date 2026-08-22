import { randomUUID } from "node:crypto";

import {
  AuditAction,
  getMarketingVoucherSafeCodeCapacity,
  type GenerateMarketingVoucherCodesInput,
  type MarketingVoucherCampaignMutationResult,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  loadMarketingVoucherMutationResult,
  newMarketingVoucherJob,
  type MarketingVoucherMutationPointer,
} from "./marketingVoucherJobMutationHelpers.js";
import {
  campaignRef,
  jobRef,
  mapMarketingVoucherCampaign,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";
import {
  assertCampaignAllowsGeneration,
  assertMarketingVoucherRevision,
} from "./marketingVoucherRepositoryGuards.js";

export const createMarketingVoucherGenerationJobRecord = async (input: {
  campaign_id: string;
  request: GenerateMarketingVoucherCodesInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const jobId = randomUUID();
  const pointer = await db.runTransaction<MarketingVoucherMutationPointer>(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "GENERATE_CODES",
      input.context,
      { campaign_id: input.campaign_id, request: input.request },
    );
    if (operation.replay) return { ...operation.replay, replayed: true } as MarketingVoucherMutationPointer;
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
    assertMarketingVoucherRevision(previous.revision, input.request.expected_revision);
    assertCampaignAllowsGeneration(previous);
    if (
      previous.total_issued + input.request.quantity >
      getMarketingVoucherSafeCodeCapacity(previous.code_length)
    ) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_CODE_SPACE_UNSAFE",
        {
          vi: "Số lượng yêu cầu vượt quá không gian mã an toàn. Hãy tăng độ dài mã.",
          zh: "请求数量超过安全券码空间，请增加券码长度。",
        },
        400,
      );
    }
    if (previous.active_generation_job_id) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_GENERATION_ALREADY_RUNNING",
        { vi: "Chiến dịch đang có một job sinh mã.", zh: "活动已有券码生成任务。" },
        409,
      );
    }
    const now = new Date();
    const job = newMarketingVoucherJob({
      id: jobId,
      campaignId: previous.id,
      type: "GENERATE_CODES",
      generationMode: "APPEND",
      targetValidTo: null,
      total: input.request.quantity,
      context: input.context,
      now,
    });
    const updated = {
      ...previous,
      active_generation_job_id: jobId,
      revision: previous.revision + 1,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const result = { campaign_id: previous.id, job_id: jobId };
    transaction.create(jobRef(jobId), job);
    transaction.set(ref, updated);
    writeMarketingVoucherAudit(transaction, {
      id: `${operation.id}:generate`,
      action: AuditAction.MARKETING_VOUCHER_CODES_GENERATE,
      entity_type: "marketing_voucher_campaigns",
      entity_id: previous.id,
      entity_name: previous.name,
      context: input.context,
      old_value: previous,
      new_value: updated,
      sync_time: now,
      notes: `Queued append generation job for ${input.request.quantity} codes`,
    });
    writeMarketingVoucherOperation(transaction, operation, "GENERATE_CODES", input.context, result, now);
    return { ...result, replayed: false };
  });
  return loadMarketingVoucherMutationResult(pointer);
};
