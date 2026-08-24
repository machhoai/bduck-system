import { randomUUID } from "node:crypto";

import {
  AuditAction,
  type CreateMarketingVoucherEmailJobInput,
  type MarketingVoucherCampaignMutationResult,
  type MarketingVoucherJobItem,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  loadMarketingVoucherMutationResult,
  newMarketingVoucherJob,
  type MarketingVoucherMutationPointer,
} from "./marketingVoucherJobMutationHelpers.js";
import {
  campaignRef,
  codeRef,
  jobItemRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherCode,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";
import {
  assertCampaignActivityAllowed,
  assertCampaignMutable,
} from "./marketingVoucherRepositoryGuards.js";

const vietnamToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

export const createMarketingVoucherEmailJobRecord = async (input: {
  request: CreateMarketingVoucherEmailJobInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const jobId = randomUUID();
  const itemIds = input.request.recipients.map(() => randomUUID());
  const codeIds = input.request.recipients.flatMap(
    (recipient) => recipient.voucher_code_ids,
  );
  const pointer = await db.runTransaction<MarketingVoucherMutationPointer>(
    async (transaction) => {
      const operation = await prepareMarketingVoucherOperation(
        transaction,
        "CREATE_EMAIL_JOB",
        input.context,
        input.request,
      );
      if (operation.replay) {
        return {
          ...operation.replay,
          replayed: true,
        } as MarketingVoucherMutationPointer;
      }
      const campaignSnapshot = await transaction.get(
        campaignRef(input.request.campaign_id),
      );
      if (
        !campaignSnapshot.exists ||
        campaignSnapshot.get("is_deleted") === true
      ) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
          { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
          404,
        );
      }
      const campaign = mapMarketingVoucherCampaign(campaignSnapshot);
      assertCampaignMutable(campaign);
      assertCampaignActivityAllowed(campaign, "EMAIL");
      if (campaign.active_extension_job_id) {
        throw marketingVoucherError("MARKETING_VOUCHER_EXTENSION_IN_PROGRESS", {
          vi: "Hãy đợi job gia hạn hoàn tất trước khi gửi email.",
          zh: "请等待延期任务完成后再发送邮件。",
        });
      }
      const codeSnapshots = await transaction.getAll(...codeIds.map(codeRef));
      const today = vietnamToday();
      codeSnapshots.forEach((snapshot) => {
        if (!snapshot.exists || snapshot.get("is_deleted") === true) {
          throw marketingVoucherError(
            "MARKETING_VOUCHER_CODE_NOT_FOUND",
            { vi: "Có mã voucher không tồn tại.", zh: "部分优惠券码不存在。" },
            404,
          );
        }
        const code = mapMarketingVoucherCode(snapshot);
        if (
          code.campaign_id !== campaign.id ||
          !["AVAILABLE", "DISTRIBUTED"].includes(code.status) ||
          code.valid_to < today
        ) {
          throw marketingVoucherError(
            "MARKETING_VOUCHER_CODE_NOT_EMAIL_ELIGIBLE",
            {
              vi: `Mã ${code.id} không đủ điều kiện gửi email.`,
              zh: `优惠券码 ${code.id} 不符合邮件发送条件。`,
            },
          );
        }
      });
      const now = new Date();
      const job = {
        ...newMarketingVoucherJob({
          id: jobId,
          campaignId: campaign.id,
          type: "SEND_EMAIL",
          generationMode: null,
          targetValidTo: null,
          total: input.request.recipients.length,
          context: input.context,
          now,
        }),
        email_subject: input.request.subject,
        email_introduction: input.request.introduction,
      };
      const items: MarketingVoucherJobItem[] = input.request.recipients.map(
        (recipient, index) => ({
          id: itemIds[index],
          job_id: jobId,
          campaign_id: campaign.id,
          voucher_code_ids: recipient.voucher_code_ids,
          recipient_email: recipient.email.trim().toLowerCase(),
          status: "QUEUED",
          attempt_count: 0,
          last_error_code: null,
          last_error_message: null,
          brevo_message_id: null,
          completed_at: null,
          is_deleted: false,
          created_at: now,
          updated_at: now,
          action_time: input.context.action_time,
          sync_time: now,
        }),
      );
      transaction.create(jobRef(jobId), job);
      items.forEach((item) =>
        transaction.create(jobItemRef(jobId, item.id), item),
      );
      const result = { campaign_id: campaign.id, job_id: jobId };
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:email-job`,
        action: AuditAction.MARKETING_VOUCHER_EMAIL_JOB_CREATE,
        entity_type: "marketing_voucher_jobs",
        entity_id: jobId,
        entity_name: campaign.name,
        context: input.context,
        old_value: null,
        new_value: {
          job,
          item_count: items.length,
          voucher_count: codeIds.length,
        },
        sync_time: now,
        notes: `Queued ${items.length} voucher emails`,
      });
      writeMarketingVoucherOperation(
        transaction,
        operation,
        "CREATE_EMAIL_JOB",
        input.context,
        result,
        now,
      );
      return { ...result, replayed: false };
    },
  );
  return loadMarketingVoucherMutationResult(pointer);
};
