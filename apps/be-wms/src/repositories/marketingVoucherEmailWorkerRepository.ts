import {
  AuditAction,
  type MarketingVoucherCampaign,
  type MarketingVoucherCode,
  type MarketingVoucherJob,
  type MarketingVoucherJobItem,
  type NotificationDispatch,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  codeRef,
  jobItemRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherCode,
  mapMarketingVoucherJob,
  mapMarketingVoucherJobItem,
  writeMarketingVoucherAudit,
} from "./marketingVoucherRepository.js";

export const MARKETING_VOUCHER_EMAIL_CONCURRENCY = 3;

export interface MarketingVoucherEmailClaim {
  campaign: MarketingVoucherCampaign;
  job: MarketingVoucherJob;
  items: MarketingVoucherJobItem[];
}

export const claimMarketingVoucherEmailItems = async (
  jobId: string,
  limit = MARKETING_VOUCHER_EMAIL_CONCURRENCY,
): Promise<MarketingVoucherEmailClaim | null> =>
  db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef(jobId));
    if (!jobSnapshot.exists) throw new Error("MARKETING_VOUCHER_JOB_NOT_FOUND");
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    if (
      previousJob.type !== "SEND_EMAIL" ||
      ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(
        previousJob.status,
      )
    ) {
      return null;
    }
    if (previousJob.status === "PAUSED") return null;
    const campaignSnapshot = await transaction.get(
      campaignRef(previousJob.campaign_id),
    );
    if (!campaignSnapshot.exists)
      throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
    const campaign = mapMarketingVoucherCampaign(campaignSnapshot);
    if (campaign.is_deleted || campaign.status === "ENDED") {
      const now = new Date();
      transaction.update(jobSnapshot.ref, {
        status: "CANCELLED",
        completed_at: now,
        revision: previousJob.revision + 1,
        updated_at: now,
        sync_time: now,
      });
      return null;
    }
    if (campaign.status === "PAUSED") {
      const now = new Date();
      transaction.update(jobSnapshot.ref, {
        status: "PAUSED",
        revision: previousJob.revision + 1,
        updated_at: now,
        sync_time: now,
      });
      return null;
    }
    const itemQuery = jobRef(jobId)
      .collection("items")
      .where("status", "==", "QUEUED")
      .limit(Math.min(Math.max(1, limit), MARKETING_VOUCHER_EMAIL_CONCURRENCY));
    const itemSnapshot = await transaction.get(itemQuery);
    const items = itemSnapshot.docs
      .map(mapMarketingVoucherJobItem)
      .filter((item) => !item.is_deleted);
    if (items.length === 0) return null;
    const now = new Date();
    const claimedItems = items.map((item) => ({
      ...item,
      status: "PROCESSING" as const,
      attempt_count: item.attempt_count + 1,
      updated_at: now,
      sync_time: now,
    }));
    claimedItems.forEach((item) =>
      transaction.set(jobItemRef(jobId, item.id), item),
    );
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: "PROCESSING",
      attempt_count: previousJob.attempt_count + 1,
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(jobSnapshot.ref, updatedJob);
    return { campaign, job: updatedJob, items: claimedItems };
  });

export const loadMarketingVoucherEmailCodes = async (
  item: MarketingVoucherJobItem,
): Promise<MarketingVoucherCode[]> => {
  const snapshots = await db.getAll(...item.voucher_code_ids.map(codeRef));
  return snapshots.map((snapshot) => {
    if (!snapshot.exists) throw new Error("MARKETING_VOUCHER_CODE_NOT_FOUND");
    return mapMarketingVoucherCode(snapshot);
  });
};

const notificationDispatch = (input: {
  job: MarketingVoucherJob;
  item: MarketingVoucherJobItem;
  success: boolean;
  messageId: string | null;
  errorMessage: string | null;
  now: Date;
}): NotificationDispatch => ({
  id: `${input.job.id}:${input.item.id}:${input.item.attempt_count}`,
  channel: "EMAIL",
  status: input.success ? "SENT" : "FAILED",
  title: input.job.email_subject ?? "Voucher",
  body_text: input.job.email_introduction,
  body_html: null,
  recipient_user_ids: [],
  recipient_role_ids: [],
  recipient_emails: input.item.recipient_email
    ? [input.item.recipient_email]
    : [],
  cc_emails: [],
  bcc_emails: [],
  brevo_message_id: input.messageId,
  error_message: input.errorMessage,
  sent_count: input.success ? 1 : 0,
  failed_count: input.success ? 0 : 1,
  created_by: input.job.requested_by,
  action_time: input.job.action_time,
  sync_time: input.now,
  is_deleted: false,
  created_at: input.now,
  updated_at: input.now,
});

export const completeMarketingVoucherEmailItem = async (input: {
  job_id: string;
  item_id: string;
  attempt_count: number;
  success: boolean;
  message_id: string | null;
  error_code: string | null;
  error_message: string | null;
}): Promise<MarketingVoucherJob> =>
  db.runTransaction(async (transaction) => {
    const [jobSnapshot, itemSnapshot] = await Promise.all([
      transaction.get(jobRef(input.job_id)),
      transaction.get(jobItemRef(input.job_id, input.item_id)),
    ]);
    if (!jobSnapshot.exists || !itemSnapshot.exists)
      throw new Error("MARKETING_VOUCHER_EMAIL_ITEM_NOT_FOUND");
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    const previousItem = mapMarketingVoucherJobItem(itemSnapshot);
    if (
      previousItem.status !== "PROCESSING" ||
      previousItem.attempt_count !== input.attempt_count
    ) {
      return previousJob;
    }
    const campaignSnapshot = await transaction.get(
      campaignRef(previousJob.campaign_id),
    );
    if (!campaignSnapshot.exists)
      throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
    const previousCampaign = mapMarketingVoucherCampaign(campaignSnapshot);
    const codeSnapshots = input.success
      ? await transaction.getAll(...previousItem.voucher_code_ids.map(codeRef))
      : [];
    const codes = codeSnapshots.map(mapMarketingVoucherCode);
    const now = new Date();
    if (input.success && previousItem.recipient_email) {
      codes.forEach((code, index) => {
        transaction.update(codeSnapshots[index].ref, {
          emailed_at: now,
          emailed_to: previousItem.recipient_email,
          revision: code.revision + 1,
          updated_by: previousJob.requested_by,
          updated_at: now,
          sync_time: now,
        });
      });
    }
    const completedItem: MarketingVoucherJobItem = {
      ...previousItem,
      status: input.success ? "SUCCEEDED" : "FAILED",
      last_error_code: input.error_code,
      last_error_message: input.error_message?.slice(0, 1_000) ?? null,
      brevo_message_id: input.message_id,
      completed_at: now,
      updated_at: now,
      sync_time: now,
    };
    const processed = previousJob.progress.processed + 1;
    const succeeded = previousJob.progress.succeeded + (input.success ? 1 : 0);
    const failed = previousJob.progress.failed + (input.success ? 0 : 1);
    const finished = processed >= previousJob.progress.total;
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: finished
        ? failed === 0
          ? "COMPLETED"
          : succeeded === 0
            ? "FAILED"
            : "PARTIAL"
        : "PROCESSING",
      progress: { ...previousJob.progress, processed, succeeded, failed },
      last_error_code: input.success
        ? previousJob.last_error_code
        : input.error_code,
      last_error_message: input.success
        ? previousJob.last_error_message
        : (input.error_message?.slice(0, 1_000) ?? null),
      completed_at: finished ? now : null,
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(itemSnapshot.ref, completedItem);
    transaction.set(jobSnapshot.ref, updatedJob);
    const dispatch = notificationDispatch({
      job: previousJob,
      item: previousItem,
      success: input.success,
      messageId: input.message_id,
      errorMessage: input.error_message,
      now,
    });
    transaction.create(
      db.collection("notification_dispatches").doc(dispatch.id),
      dispatch,
    );
    writeMarketingVoucherAudit(transaction, {
      id: `${previousJob.id}:email:${previousItem.id}:${previousItem.attempt_count}`,
      action: AuditAction.MARKETING_VOUCHER_EMAIL_ITEM_SEND,
      entity_type: "marketing_voucher_jobs",
      entity_id: previousJob.id,
      entity_name: previousCampaign.name,
      context: {
        actor_id: previousJob.requested_by,
        action_time: previousJob.action_time,
        idempotency_key: previousJob.idempotency_key,
      },
      old_value: previousItem,
      new_value: completedItem,
      sync_time: now,
      notes: input.success
        ? "Voucher email sent"
        : `Voucher email failed: ${input.error_code}`,
    });
    return updatedJob;
  });
