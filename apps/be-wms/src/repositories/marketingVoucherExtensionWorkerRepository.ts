import {
  AuditAction,
  MARKETING_VOUCHER_CODES_COLLECTION,
  type MarketingVoucherCode,
  type MarketingVoucherJob,
} from "@bduck/shared-types";
import { FieldPath } from "firebase-admin/firestore";


import { db } from "../config/firebase.js";

import type { MarketingVoucherWorkerResult } from "./marketingVoucherGenerationWorkerRepository.js";
import {
  campaignRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherCode,
  mapMarketingVoucherJob,
  writeMarketingVoucherAudit,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";

export const MARKETING_VOUCHER_EXTENSION_CHUNK_SIZE = 400;

const loadEligibleCodes = async (input: {
  campaignId: string;
  cursor: string | null;
  limit: number;
}) => {
  let query: FirebaseFirestore.Query = db
    .collection(MARKETING_VOUCHER_CODES_COLLECTION)
    .where("campaign_id", "==", input.campaignId)
    .where("is_deleted", "==", false)
    .where("status", "in", ["AVAILABLE", "DISTRIBUTED"])
    .orderBy(FieldPath.documentId())
    .limit(input.limit);
  if (input.cursor) query = query.startAfter(input.cursor);
  return query.get();
};

const updateCode = (
  previous: MarketingVoucherCode,
  validTo: string,
  actorId: string,
  actionTime: Date,
  now: Date,
): MarketingVoucherCode => ({
  ...previous,
  valid_to: validTo,
  revision: previous.revision + 1,
  updated_by: actorId,
  updated_at: now,
  action_time: actionTime,
  sync_time: now,
});

export const processMarketingVoucherExtensionChunk = async (
  jobId: string,
  chunkSize = MARKETING_VOUCHER_EXTENSION_CHUNK_SIZE,
): Promise<MarketingVoucherWorkerResult> => {
  const initialJobSnapshot = await jobRef(jobId).get();
  if (!initialJobSnapshot.exists) throw new Error("MARKETING_VOUCHER_JOB_NOT_FOUND");
  const initialJob = mapMarketingVoucherJob(initialJobSnapshot);
  if (initialJob.type !== "EXTEND_EXPIRY" || !initialJob.target_valid_to) {
    return { job: initialJob, should_dispatch: false, no_op: true };
  }
  if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(initialJob.status)) {
    return { job: initialJob, should_dispatch: false, no_op: true };
  }
  const candidates = await loadEligibleCodes({
    campaignId: initialJob.campaign_id,
    cursor: initialJob.cursor,
    limit: Math.min(Math.max(1, chunkSize), 400),
  });

  return db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef(jobId));
    if (!jobSnapshot.exists) throw new Error("MARKETING_VOUCHER_JOB_NOT_FOUND");
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    if (
      previousJob.revision !== initialJob.revision ||
      ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(previousJob.status)
    ) {
      return { job: previousJob, should_dispatch: false, no_op: true };
    }
    const campaignSnapshot = await transaction.get(campaignRef(previousJob.campaign_id));
    if (!campaignSnapshot.exists) throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
    const previousCampaign = mapMarketingVoucherCampaign(campaignSnapshot);
    if (previousCampaign.is_deleted || previousCampaign.status === "ENDED") {
      const now = new Date();
      const cancelled: MarketingVoucherJob = {
        ...previousJob,
        status: "CANCELLED",
        completed_at: now,
        revision: previousJob.revision + 1,
        updated_at: now,
        sync_time: now,
      };
      transaction.set(jobSnapshot.ref, cancelled);
      return { job: cancelled, should_dispatch: false, no_op: false };
    }

    const codeSnapshots = candidates.empty
      ? []
      : await transaction.getAll(
          ...candidates.docs.map((document) => document.ref),
        );
    const now = new Date();
    const eligible = codeSnapshots
      .filter(
        (snapshot) =>
          snapshot.exists &&
          snapshot.get("is_deleted") !== true &&
          ["AVAILABLE", "DISTRIBUTED"].includes(String(snapshot.get("status"))),
      )
      .map(mapMarketingVoucherCode);
    eligible.forEach((code) => {
      transaction.set(
        codeSnapshots.find((snapshot) => snapshot.id === code.id)!.ref,
        updateCode(
          code,
          previousJob.target_valid_to!,
          previousJob.requested_by,
          previousJob.action_time,
          now,
        ),
      );
    });

    const lastCursor = candidates.docs.at(-1)?.id ?? previousJob.cursor;
    const completed = candidates.size < Math.min(Math.max(1, chunkSize), 400);
    const succeeded = previousJob.progress.succeeded + eligible.length;
    const processed = completed
      ? previousJob.progress.total
      : previousJob.progress.processed + candidates.size;
    const failed = completed ? Math.max(0, previousJob.progress.total - succeeded) : 0;
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: completed ? (failed > 0 ? "PARTIAL" : "COMPLETED") : "PROCESSING",
      cursor: lastCursor,
      progress: { ...previousJob.progress, processed, succeeded, failed },
      attempt_count: previousJob.attempt_count + 1,
      completed_at: completed ? now : null,
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    const updatedCampaign = {
      ...previousCampaign,
      valid_to: completed ? previousJob.target_valid_to! : previousCampaign.valid_to,
      active_extension_job_id: completed ? null : previousJob.id,
      revision: previousCampaign.revision + 1,
      updated_by: previousJob.requested_by,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(jobSnapshot.ref, updatedJob);
    transaction.set(campaignSnapshot.ref, updatedCampaign);
    const context: MarketingVoucherOperationContext = {
      actor_id: previousJob.requested_by,
      action_time: previousJob.action_time,
      idempotency_key: previousJob.idempotency_key,
    };
    writeMarketingVoucherAudit(transaction, {
      id: `${previousJob.id}:extension:${previousJob.progress.processed}-${processed}`,
      action: AuditAction.MARKETING_VOUCHER_EXPIRY_EXTEND,
      entity_type: "marketing_voucher_jobs",
      entity_id: previousJob.id,
      entity_name: previousCampaign.name,
      context,
      old_value: previousJob,
      new_value: updatedJob,
      sync_time: now,
      notes: `Extended ${eligible.length} voucher codes to ${previousJob.target_valid_to}`,
    });
    return { job: updatedJob, should_dispatch: !completed, no_op: false };
  });
};

export const failMarketingVoucherExtensionJob = async (
  jobId: string,
  failure: { code: string; message: string },
): Promise<void> => {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef(jobId));
    if (!snapshot.exists) return;
    const job = mapMarketingVoucherJob(snapshot);
    if (["COMPLETED", "PARTIAL", "CANCELLED"].includes(job.status)) return;
    const campaignSnapshot = await transaction.get(campaignRef(job.campaign_id));
    const campaign = campaignSnapshot.exists
      ? mapMarketingVoucherCampaign(campaignSnapshot)
      : null;
    const now = new Date();
    const updatedJob: MarketingVoucherJob = {
      ...job,
      status: "FAILED",
      last_error_code: failure.code,
      last_error_message: failure.message.slice(0, 1_000),
      revision: job.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(snapshot.ref, updatedJob);
    writeMarketingVoucherAudit(transaction, {
      id: `${job.id}:failure:${job.revision}`,
      action: AuditAction.MARKETING_VOUCHER_EXPIRY_EXTEND,
      entity_type: "marketing_voucher_jobs",
      entity_id: job.id,
      entity_name: campaign?.name ?? null,
      context: {
        actor_id: job.requested_by,
        action_time: job.action_time,
        idempotency_key: job.idempotency_key,
      },
      old_value: job,
      new_value: updatedJob,
      sync_time: now,
      notes: `Extension failed: ${failure.code}`,
    });
  });
};
