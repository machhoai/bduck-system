import {
  AuditAction,
  type ChangeMarketingVoucherCampaignStatusInput,
  type MarketingVoucherCampaignMutationResult,
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
import { assertMarketingVoucherRevision } from "./marketingVoucherRepositoryGuards.js";

const loadResult = async (
  campaignId: string,
  jobId: string | null,
  replayed: boolean,
): Promise<MarketingVoucherCampaignMutationResult> => {
  const [campaign, job] = await Promise.all([
    campaignRef(campaignId).get(),
    jobId ? jobRef(jobId).get() : null,
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
    replayed,
  };
};

export const changeMarketingVoucherCampaignStatusRecord = async (input: {
  campaign_id: string;
  request: ChangeMarketingVoucherCampaignStatusInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const result = await db.runTransaction<{
    campaign_id: string;
    job_id: string | null;
    replayed: boolean;
  }>(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "CHANGE_CAMPAIGN_STATUS",
      input.context,
      { campaign_id: input.campaign_id, request: input.request },
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
      input.request.expected_revision,
    );
    if (previous.status === "ENDED") {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_CAMPAIGN_ENDED",
        { vi: "Chiến dịch đã kết thúc.", zh: "优惠券活动已结束。" },
        409,
      );
    }
    if (previous.status === "GENERATION_FAILED") {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_JOB_RESUME_REQUIRED",
        {
          vi: "Hãy tiếp tục job sinh mã bị lỗi trước khi kích hoạt chiến dịch.",
          zh: "请先恢复失败的券码生成任务，再启用活动。",
        },
        409,
      );
    }

    const activeJobId = previous.active_generation_job_id;
    const activeJobSnapshot = activeJobId
      ? await transaction.get(jobRef(activeJobId))
      : null;
    const activeJob = activeJobSnapshot?.exists
      ? mapMarketingVoucherJob(activeJobSnapshot)
      : null;
    const now = new Date();
    const targetStatus =
      input.request.status === "PAUSED"
        ? "PAUSED"
        : activeJob?.generation_mode === "INITIAL" &&
            activeJob.progress.succeeded < activeJob.progress.total
          ? "GENERATING"
          : "ACTIVE";
    const updated = {
      ...previous,
      status: targetStatus,
      revision: previous.revision + 1,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    transaction.set(ref, updated);

    if (
      activeJob &&
      activeJob.status !== "FAILED" &&
      !["COMPLETED", "CANCELLED"].includes(activeJob.status)
    ) {
      transaction.update(jobRef(activeJob.id), {
        status: input.request.status === "PAUSED" ? "PAUSED" : "QUEUED",
        revision: activeJob.revision + 1,
        updated_at: now,
        sync_time: now,
      });
    }
    const operationResult = {
      campaign_id: updated.id,
      job_id: activeJob?.id ?? null,
    };
    writeMarketingVoucherAudit(transaction, {
      id: `${operation.id}:status`,
      action: AuditAction.MARKETING_VOUCHER_CAMPAIGN_STATUS,
      entity_type: "marketing_voucher_campaigns",
      entity_id: updated.id,
      entity_name: updated.name,
      context: input.context,
      old_value: previous,
      new_value: updated,
      sync_time: now,
      notes: `Marketing voucher campaign status changed to ${targetStatus}`,
    });
    writeMarketingVoucherOperation(
      transaction,
      operation,
      "CHANGE_CAMPAIGN_STATUS",
      input.context,
      operationResult,
      now,
    );
    return { ...operationResult, replayed: false };
  });
  return loadResult(
    String(result.campaign_id),
    result.job_id ? String(result.job_id) : null,
    result.replayed === true,
  );
};

export const softDeleteMarketingVoucherCampaignRecord = async (input: {
  campaign_id: string;
  expected_revision: number;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const result = await db.runTransaction<{
    campaign_id: string;
    job_id: string | null;
    replayed: boolean;
  }>(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "SOFT_DELETE_CAMPAIGN",
      input.context,
      { campaign_id: input.campaign_id, expected_revision: input.expected_revision },
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
    assertMarketingVoucherRevision(previous.revision, input.expected_revision);
    const now = new Date();
    const updated = {
      ...previous,
      status: "ENDED" as const,
      is_deleted: true,
      active_generation_job_id: null,
      active_extension_job_id: null,
      revision: previous.revision + 1,
      updated_by: input.context.actor_id,
      updated_at: now,
      action_time: input.context.action_time,
      sync_time: now,
    };
    const jobIds = [
      previous.active_generation_job_id,
      previous.active_extension_job_id,
    ].filter((value): value is string => Boolean(value));
    const jobSnapshots = await Promise.all(
      jobIds.map((id) => transaction.get(jobRef(id))),
    );
    transaction.set(ref, updated);
    jobSnapshots.forEach((jobSnapshot) => {
      if (!jobSnapshot.exists) return;
      transaction.update(jobSnapshot.ref, {
        status: "CANCELLED",
        completed_at: now,
        updated_at: now,
        sync_time: now,
        revision: Number(jobSnapshot.get("revision") ?? 0) + 1,
      });
    });
    const operationResult = { campaign_id: updated.id, job_id: null };
    writeMarketingVoucherAudit(transaction, {
      id: `${operation.id}:soft-delete`,
      action: AuditAction.MARKETING_VOUCHER_CAMPAIGN_SOFT_DELETE,
      entity_type: "marketing_voucher_campaigns",
      entity_id: updated.id,
      entity_name: updated.name,
      context: input.context,
      old_value: previous,
      new_value: updated,
      sync_time: now,
      notes: "Marketing voucher campaign soft deleted",
    });
    writeMarketingVoucherOperation(
      transaction,
      operation,
      "SOFT_DELETE_CAMPAIGN",
      input.context,
      operationResult,
      now,
    );
    return { ...operationResult, replayed: false };
  });
  return loadResult(String(result.campaign_id), null, result.replayed === true);
};
