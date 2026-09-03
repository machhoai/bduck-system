import { randomUUID } from "node:crypto";

import {
  AuditAction,
  type CreateMarketingVoucherExportJobInput,
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
  assertCampaignActivityAllowed,
  assertMarketingVoucherRevision,
} from "./marketingVoucherRepositoryGuards.js";

export async function createMarketingVoucherExportJobRecord(input: {
  campaign_id: string;
  request: CreateMarketingVoucherExportJobInput & { expected_revision: number };
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> {
  const jobId = randomUUID();
  const pointer = await db.runTransaction<MarketingVoucherMutationPointer>(
    async (transaction) => {
      const operation = await prepareMarketingVoucherOperation(
        transaction,
        "EXPORT_EXCEL",
        input.context,
        { campaign_id: input.campaign_id, request: input.request },
      );
      if (operation.replay) {
        return {
          ...operation.replay,
          replayed: true,
        } as MarketingVoucherMutationPointer;
      }
      const snapshot = await transaction.get(campaignRef(input.campaign_id));
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
        input.request.expected_revision,
      );
      assertCampaignActivityAllowed(previous, "EXPORT");
      if (previous.purpose !== "PRINT") {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_EXPORT_PRINT_ONLY",
          {
            vi: "Chỉ chiến dịch in ấn mới được xuất Excel voucher.",
            zh: "只有印刷活动可以导出优惠券 Excel。",
          },
          409,
        );
      }
      if (previous.status !== "ACTIVE") {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_EXPORT_NOT_ACTIVE",
          {
            vi: "Chiến dịch phải hoạt động trước khi xuất voucher.",
            zh: "活动必须处于启用状态才能导出优惠券。",
          },
          409,
        );
      }
      if (
        previous.active_generation_job_id ||
        previous.active_extension_job_id ||
        previous.active_export_job_id
      ) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_CAMPAIGN_JOB_CONFLICT",
          {
            vi: "Chiến dịch đang có job thay đổi hoặc xuất mã voucher.",
            zh: "活动已有券码变更或导出任务。",
          },
          409,
        );
      }
      if (previous.code_counts.total < 1) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_EXPORT_EMPTY",
          {
            vi: "Chiến dịch chưa có mã để xuất.",
            zh: "活动没有可导出的券码。",
          },
          409,
        );
      }
      const now = new Date();
      const job = {
        ...newMarketingVoucherJob({
          id: jobId,
          campaignId: previous.id,
          type: "EXPORT_EXCEL",
          generationMode: null,
          targetValidTo: null,
          total: previous.code_counts.total,
          context: input.context,
          now,
        }),
        export_locale: input.request.locale,
      };
      const updated = {
        ...previous,
        active_export_job_id: jobId,
        revision: previous.revision + 1,
        updated_by: input.context.actor_id,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      const result = { campaign_id: previous.id, job_id: jobId };
      transaction.create(jobRef(jobId), job);
      transaction.set(snapshot.ref, updated);
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:export`,
        action: AuditAction.MARKETING_VOUCHER_EXPORT_JOB_CREATE,
        entity_type: "marketing_voucher_jobs",
        entity_id: jobId,
        entity_name: previous.name,
        context: input.context,
        old_value: null,
        new_value: job,
        sync_time: now,
        notes: `Queued voucher export with ${job.progress.total} rows`,
      });
      writeMarketingVoucherOperation(
        transaction,
        operation,
        "EXPORT_EXCEL",
        input.context,
        result,
        now,
      );
      return { ...result, replayed: false };
    },
  );
  return loadMarketingVoucherMutationResult(pointer);
}
