import { randomBytes } from "node:crypto";

import {
  AuditAction,
  MARKETING_VOUCHER_CODE_ALPHABET_SIZE,
  type MarketingVoucherCampaign,
  type MarketingVoucherCode,
  type MarketingVoucherJob,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  codeRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherJob,
  sha256,
  writeMarketingVoucherAudit,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
if (ALPHABET.length !== MARKETING_VOUCHER_CODE_ALPHABET_SIZE) {
  throw new Error("MARKETING_VOUCHER_CODE_ALPHABET_SIZE_MISMATCH");
}
export const MARKETING_VOUCHER_GENERATION_CHUNK_SIZE = 400;

const randomSegment = (length: number) => {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
};

const buildCode = (campaign: MarketingVoucherCampaign) =>
  [campaign.prefix, randomSegment(campaign.code_length), campaign.suffix]
    .filter(Boolean)
    .join("-");

const reserveUniqueCodes = async (
  transaction: FirebaseFirestore.Transaction,
  campaign: MarketingVoucherCampaign,
  quantity: number,
) => {
  const selected = new Set<string>();
  for (let round = 0; round < 30 && selected.size < quantity; round += 1) {
    const candidates = new Set<string>();
    const target = Math.min(450, Math.max(quantity - selected.size, 32));
    while (candidates.size < target) candidates.add(buildCode(campaign));
    const refs = [...candidates].map(codeRef);
    const snapshots = await transaction.getAll(...refs);
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists && selected.size < quantity)
        selected.add(snapshot.id);
    });
  }
  if (selected.size < quantity) {
    const error = new Error("MARKETING_VOUCHER_CODE_SPACE_EXHAUSTED");
    Object.assign(error, { code: "MARKETING_VOUCHER_CODE_SPACE_EXHAUSTED" });
    throw error;
  }
  return [...selected];
};

const codeDocument = (input: {
  code: string;
  campaign: MarketingVoucherCampaign;
  job: MarketingVoucherJob;
  now: Date;
}): MarketingVoucherCode => {
  const isPrint = input.campaign.purpose === "PRINT";
  return {
    id: input.code,
    campaign_id: input.campaign.id,
    campaign_name: input.campaign.name,
    reward_type: input.campaign.reward_type,
    reward_value: input.campaign.reward_value,
    valid_to: input.campaign.valid_to,
    status: isPrint ? "DISTRIBUTED" : "AVAILABLE",
    distributed_to_phone: null,
    distributed_at: isPrint ? input.now : null,
    used_at: null,
    used_by_staff_id: null,
    used_by_staff_name: null,
    emailed_at: null,
    emailed_to: null,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    source_hash: sha256(`${input.campaign.id}:${input.code}`),
    revision: 1,
    created_by: input.job.requested_by,
    updated_by: input.job.requested_by,
    legacy_metadata: null,
    is_deleted: false,
    created_at: input.now,
    updated_at: input.now,
    action_time: input.job.action_time,
    sync_time: input.now,
  };
};

export interface MarketingVoucherWorkerResult {
  job: MarketingVoucherJob;
  should_dispatch: boolean;
  no_op: boolean;
}

export const processMarketingVoucherGenerationChunk = async (
  jobId: string,
  chunkSize = MARKETING_VOUCHER_GENERATION_CHUNK_SIZE,
): Promise<MarketingVoucherWorkerResult> =>
  db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef(jobId));
    if (!jobSnapshot.exists) throw new Error("MARKETING_VOUCHER_JOB_NOT_FOUND");
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    if (
      previousJob.type !== "GENERATE_CODES" ||
      ["COMPLETED", "CANCELLED", "FAILED"].includes(previousJob.status)
    ) {
      return { job: previousJob, should_dispatch: false, no_op: true };
    }
    const campaignSnapshot = await transaction.get(
      campaignRef(previousJob.campaign_id),
    );
    if (!campaignSnapshot.exists)
      throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
    const previousCampaign = mapMarketingVoucherCampaign(campaignSnapshot);
    if (previousCampaign.is_deleted || previousCampaign.status === "ENDED") {
      const now = new Date();
      const cancelled = {
        ...previousJob,
        status: "CANCELLED" as const,
        completed_at: now,
        revision: previousJob.revision + 1,
        updated_at: now,
        sync_time: now,
      };
      transaction.set(jobSnapshot.ref, cancelled);
      return { job: cancelled, should_dispatch: false, no_op: false };
    }
    if (
      previousCampaign.status === "PAUSED" ||
      previousJob.status === "PAUSED"
    ) {
      return { job: previousJob, should_dispatch: false, no_op: true };
    }

    const remaining =
      previousJob.progress.total - previousJob.progress.succeeded;
    const requested = Math.min(Math.max(1, chunkSize), remaining);
    const codes = await reserveUniqueCodes(
      transaction,
      previousCampaign,
      requested,
    );
    const now = new Date();
    codes.forEach((code) => {
      transaction.create(
        codeRef(code),
        codeDocument({
          code,
          campaign: previousCampaign,
          job: previousJob,
          now,
        }),
      );
    });
    const succeeded = previousJob.progress.succeeded + codes.length;
    const completed = succeeded === previousJob.progress.total;
    const statusCountKey =
      previousCampaign.purpose === "PRINT" ? "distributed" : "available";
    const updatedCampaign: MarketingVoucherCampaign = {
      ...previousCampaign,
      status:
        completed && previousJob.generation_mode === "INITIAL"
          ? "ACTIVE"
          : previousCampaign.status,
      active_generation_job_id: completed ? null : previousJob.id,
      code_counts: {
        ...previousCampaign.code_counts,
        [statusCountKey]:
          previousCampaign.code_counts[statusCountKey] + codes.length,
        total: previousCampaign.code_counts.total + codes.length,
      },
      total_issued: previousCampaign.total_issued + codes.length,
      revision: previousCampaign.revision + 1,
      updated_by: previousJob.requested_by,
      updated_at: now,
      sync_time: now,
    };
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: completed ? "COMPLETED" : "PROCESSING",
      cursor: String(succeeded),
      progress: {
        ...previousJob.progress,
        processed: succeeded,
        succeeded,
      },
      attempt_count: previousJob.attempt_count + 1,
      completed_at: completed ? now : null,
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(campaignSnapshot.ref, updatedCampaign);
    transaction.set(jobSnapshot.ref, updatedJob);
    const context: MarketingVoucherOperationContext = {
      actor_id: previousJob.requested_by,
      action_time: previousJob.action_time,
      idempotency_key: previousJob.idempotency_key,
    };
    writeMarketingVoucherAudit(transaction, {
      id: `${previousJob.id}:generation:${previousJob.progress.succeeded}-${succeeded}`,
      action: AuditAction.MARKETING_VOUCHER_CODES_GENERATE,
      entity_type: "marketing_voucher_jobs",
      entity_id: previousJob.id,
      entity_name: previousCampaign.name,
      context,
      old_value: previousJob,
      new_value: updatedJob,
      sync_time: now,
      notes: `Generated ${codes.length} voucher codes`,
    });
    return { job: updatedJob, should_dispatch: !completed, no_op: false };
  });

export const failMarketingVoucherGenerationJob = async (
  jobId: string,
  failure: { code: string; message: string },
): Promise<void> => {
  await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef(jobId));
    if (!jobSnapshot.exists) return;
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    if (["COMPLETED", "CANCELLED"].includes(previousJob.status)) return;
    const campaignSnapshot = await transaction.get(
      campaignRef(previousJob.campaign_id),
    );
    const previousCampaign = campaignSnapshot.exists
      ? mapMarketingVoucherCampaign(campaignSnapshot)
      : null;
    const now = new Date();
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: "FAILED",
      last_error_code: failure.code,
      last_error_message: failure.message.slice(0, 1_000),
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(jobSnapshot.ref, updatedJob);
    let updatedCampaign = previousCampaign;
    if (previousCampaign && previousJob.generation_mode === "INITIAL") {
      updatedCampaign = {
        ...previousCampaign,
        status: "GENERATION_FAILED",
        revision: previousCampaign.revision + 1,
        updated_at: now,
        sync_time: now,
      };
      transaction.set(campaignSnapshot.ref, updatedCampaign);
    }
    writeMarketingVoucherAudit(transaction, {
      id: `${previousJob.id}:failure:${previousJob.revision}`,
      action: AuditAction.MARKETING_VOUCHER_CODES_GENERATE,
      entity_type: "marketing_voucher_jobs",
      entity_id: previousJob.id,
      entity_name: previousCampaign?.name ?? null,
      context: {
        actor_id: previousJob.requested_by,
        action_time: previousJob.action_time,
        idempotency_key: previousJob.idempotency_key,
      },
      old_value: { job: previousJob, campaign: previousCampaign },
      new_value: { job: updatedJob, campaign: updatedCampaign },
      sync_time: now,
      notes: `Generation failed: ${failure.code}`,
    });
  });
};
