import {
  AuditAction,
  type MarketingVoucherCampaignMutationResult,
  type ResumeMarketingVoucherJobInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  loadMarketingVoucherMutationResult,
  type MarketingVoucherMutationPointer,
} from "./marketingVoucherJobMutationHelpers.js";
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
import { assertMarketingVoucherRevision } from "./marketingVoucherRepositoryGuards.js";

export const resumeMarketingVoucherJobRecord = async (input: {
  job_id: string;
  request: ResumeMarketingVoucherJobInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const pointer = await db.runTransaction<MarketingVoucherMutationPointer>(
    async (transaction) => {
      const operation = await prepareMarketingVoucherOperation(
        transaction,
        "RESUME_JOB",
        input.context,
        { job_id: input.job_id, request: input.request },
      );
      if (operation.replay) {
        return { ...operation.replay, replayed: true } as MarketingVoucherMutationPointer;
      }
      const jobSnapshot = await transaction.get(jobRef(input.job_id));
      if (!jobSnapshot.exists || jobSnapshot.get("is_deleted") === true) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_JOB_NOT_FOUND",
          { vi: "Không tìm thấy job voucher.", zh: "未找到优惠券任务。" },
          404,
        );
      }
      const previousJob = mapMarketingVoucherJob(jobSnapshot);
      const campaignSnapshot = await transaction.get(campaignRef(previousJob.campaign_id));
      if (!campaignSnapshot.exists || campaignSnapshot.get("is_deleted") === true) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
          { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
          404,
        );
      }
      const previousCampaign = mapMarketingVoucherCampaign(campaignSnapshot);
      assertMarketingVoucherRevision(
        previousJob.revision,
        input.request.expected_job_revision,
        "JOB",
      );
      assertMarketingVoucherRevision(
        previousCampaign.revision,
        input.request.expected_campaign_revision,
      );
      if (["COMPLETED", "PARTIAL", "CANCELLED"].includes(previousJob.status)) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_JOB_NOT_RESUMABLE",
          { vi: "Job đã kết thúc và không thể tiếp tục.", zh: "任务已结束，无法恢复。" },
          409,
        );
      }
      if (previousJob.type === "GENERATE_CODES" && previousCampaign.status === "PAUSED") {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_CAMPAIGN_PAUSED",
          { vi: "Hãy kích hoạt lại chiến dịch trước khi tiếp tục sinh mã.", zh: "请先重新启用活动再恢复生成。" },
          409,
        );
      }
      const now = new Date();
      const updatedJob = {
        ...previousJob,
        status: "QUEUED" as const,
        last_error_code: null,
        last_error_message: null,
        completed_at: null,
        revision: previousJob.revision + 1,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      const updatedCampaign = {
        ...previousCampaign,
        status:
          previousJob.type === "GENERATE_CODES" && previousJob.generation_mode === "INITIAL"
            ? ("GENERATING" as const)
            : previousCampaign.status,
        active_generation_job_id:
          previousJob.type === "GENERATE_CODES"
            ? previousJob.id
            : previousCampaign.active_generation_job_id,
        active_extension_job_id:
          previousJob.type === "EXTEND_EXPIRY"
            ? previousJob.id
            : previousCampaign.active_extension_job_id,
        revision: previousCampaign.revision + 1,
        updated_by: input.context.actor_id,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      const result = { campaign_id: previousCampaign.id, job_id: previousJob.id };
      transaction.set(jobSnapshot.ref, updatedJob);
      transaction.set(campaignSnapshot.ref, updatedCampaign);
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:resume`,
        action: AuditAction.MARKETING_VOUCHER_JOB_RESUME,
        entity_type: "marketing_voucher_jobs",
        entity_id: previousJob.id,
        entity_name: null,
        context: input.context,
        old_value: previousJob,
        new_value: updatedJob,
        sync_time: now,
        notes: "Marketing voucher job resumed",
      });
      writeMarketingVoucherOperation(
        transaction,
        operation,
        "RESUME_JOB",
        input.context,
        result,
        now,
      );
      return { ...result, replayed: false };
    },
  );
  return loadMarketingVoucherMutationResult(pointer);
};
