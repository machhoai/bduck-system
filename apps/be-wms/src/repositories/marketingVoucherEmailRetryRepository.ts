import {
  AuditAction,
  type MarketingVoucherCampaignMutationResult,
  type RetryMarketingVoucherJobItemsInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  loadMarketingVoucherMutationResult,
  type MarketingVoucherMutationPointer,
} from "./marketingVoucherJobMutationHelpers.js";
import {
  campaignRef,
  jobItemRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherJob,
  mapMarketingVoucherJobItem,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";
import { assertCampaignActivityAllowed } from "./marketingVoucherRepositoryGuards.js";

export const retryMarketingVoucherEmailItemsRecord = async (input: {
  job_id: string;
  request: RetryMarketingVoucherJobItemsInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const pointer = await db.runTransaction<MarketingVoucherMutationPointer>(
    async (transaction) => {
      const operation = await prepareMarketingVoucherOperation(
        transaction,
        "RETRY_EMAIL_ITEMS",
        input.context,
        input.request,
      );
      if (operation.replay) {
        return {
          ...operation.replay,
          replayed: true,
        } as MarketingVoucherMutationPointer;
      }
      if (input.request.job_id !== input.job_id) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_JOB_ID_MISMATCH",
          { vi: "Job email không khớp.", zh: "邮件任务不匹配。" },
          400,
        );
      }
      const jobSnapshot = await transaction.get(jobRef(input.job_id));
      if (!jobSnapshot.exists || jobSnapshot.get("is_deleted") === true) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_JOB_NOT_FOUND",
          { vi: "Không tìm thấy job email.", zh: "未找到邮件任务。" },
          404,
        );
      }
      const previousJob = mapMarketingVoucherJob(jobSnapshot);
      if (previousJob.type !== "SEND_EMAIL") {
        throw marketingVoucherError("MARKETING_VOUCHER_EMAIL_JOB_REQUIRED", {
          vi: "Chỉ có thể gửi lại item của job email.",
          zh: "只能重试邮件任务项目。",
        });
      }
      const campaignSnapshot = await transaction.get(
        campaignRef(previousJob.campaign_id),
      );
      if (!campaignSnapshot.exists)
        throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
      const campaign = mapMarketingVoucherCampaign(campaignSnapshot);
      assertCampaignActivityAllowed(campaign, "EMAIL");
      const snapshots = await transaction.getAll(
        ...input.request.item_ids.map((itemId) =>
          jobItemRef(input.job_id, itemId),
        ),
      );
      const failedItems = snapshots
        .filter((snapshot) => snapshot.exists)
        .map(mapMarketingVoucherJobItem)
        .filter((item) => !item.is_deleted && item.status === "FAILED");
      if (failedItems.length === 0) {
        throw marketingVoucherError("MARKETING_VOUCHER_NO_FAILED_EMAIL_ITEMS", {
          vi: "Không còn email lỗi để gửi lại.",
          zh: "没有可重试的失败邮件。",
        });
      }
      const now = new Date();
      failedItems.forEach((item) =>
        transaction.update(jobItemRef(input.job_id, item.id), {
          status: "QUEUED",
          last_error_code: null,
          last_error_message: null,
          completed_at: null,
          updated_at: now,
          action_time: input.context.action_time,
          sync_time: now,
        }),
      );
      const updatedJob = {
        ...previousJob,
        status: "QUEUED" as const,
        progress: {
          ...previousJob.progress,
          processed: Math.max(
            0,
            previousJob.progress.processed - failedItems.length,
          ),
          failed: Math.max(0, previousJob.progress.failed - failedItems.length),
        },
        last_error_code: null,
        last_error_message: null,
        completed_at: null,
        revision: previousJob.revision + 1,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      transaction.set(jobSnapshot.ref, updatedJob);
      const result = { campaign_id: campaign.id, job_id: previousJob.id };
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:email-retry`,
        action: AuditAction.MARKETING_VOUCHER_EMAIL_ITEM_RETRY,
        entity_type: "marketing_voucher_jobs",
        entity_id: previousJob.id,
        entity_name: campaign.name,
        context: input.context,
        old_value: previousJob,
        new_value: {
          job: updatedJob,
          retried_item_ids: failedItems.map((item) => item.id),
        },
        sync_time: now,
        notes: `Queued ${failedItems.length} failed email items for retry`,
      });
      writeMarketingVoucherOperation(
        transaction,
        operation,
        "RETRY_EMAIL_ITEMS",
        input.context,
        result,
        now,
      );
      return { ...result, replayed: false };
    },
  );
  return loadMarketingVoucherMutationResult(pointer);
};
