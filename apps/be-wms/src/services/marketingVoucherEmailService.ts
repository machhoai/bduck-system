import type {
  CreateMarketingVoucherEmailJobInput,
  RetryMarketingVoucherJobItemsInput,
} from "@bduck/shared-types";

import { createMarketingVoucherEmailJobRecord } from "../repositories/marketingVoucherEmailJobRepository.js";
import { retryMarketingVoucherEmailItemsRecord } from "../repositories/marketingVoucherEmailRetryRepository.js";
import {
  claimMarketingVoucherEmailItems,
  completeMarketingVoucherEmailItem,
  loadMarketingVoucherEmailCodes,
} from "../repositories/marketingVoucherEmailWorkerRepository.js";
import { findMarketingVoucherJobById } from "../repositories/marketingVoucherQueryRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import { sendBrevoEmail } from "./brevoEmailService.js";
import { assertMarketingVoucherPermission } from "./marketingVoucherAccessPolicy.js";
import { renderMarketingVoucherEmail } from "./marketingVoucherEmailRenderer.js";
import {
  marketingVoucherOperationContext,
  type MarketingVoucherRequestMetadata,
} from "./marketingVoucherOperationContext.js";
import { dispatchMarketingVoucherJob } from "./marketingVoucherTaskDispatcher.js";

export const createMarketingVoucherEmailJob = async (
  request: CreateMarketingVoucherEmailJobInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.email.send",
  );
  const result = await createMarketingVoucherEmailJobRecord({
    request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
  if (result.job) {
    await dispatchMarketingVoucherJob({
      jobId: result.job.id,
      revision: result.job.revision,
    });
  }
  return result;
};

export const retryMarketingVoucherEmailItems = async (
  jobId: string,
  request: RetryMarketingVoucherJobItemsInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.email.send",
  );
  const result = await retryMarketingVoucherEmailItemsRecord({
    job_id: jobId,
    request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
  if (result.job) {
    await dispatchMarketingVoucherJob({
      jobId: result.job.id,
      revision: result.job.revision,
    });
  }
  return result;
};

const errorDetails = (error: unknown) => ({
  code:
    (error as { code?: string }).code ??
    (error instanceof Error ? error.message : "MARKETING_VOUCHER_EMAIL_FAILED"),
  message:
    (error as { messages?: { vi?: string } }).messages?.vi ??
    (error instanceof Error ? error.message : String(error)),
});

export const processMarketingVoucherEmailChunk = async (
  jobId: string,
  sendEmail: typeof sendBrevoEmail = sendBrevoEmail,
) => {
  const claim = await claimMarketingVoucherEmailItems(jobId);
  if (!claim || claim.items.length === 0) {
    const job = await findMarketingVoucherJobById(jobId);
    return { job, should_dispatch: false, no_op: true };
  }
  await Promise.all(
    claim.items.map(async (item) => {
      try {
        const codes = await loadMarketingVoucherEmailCodes(item);
        const rendered = await renderMarketingVoucherEmail({
          campaign: claim.campaign,
          codes,
          introduction: claim.job.email_introduction ?? "",
        });
        const result = await sendEmail({
          to: item.recipient_email ? [item.recipient_email] : [],
          subject: claim.job.email_subject ?? claim.campaign.name,
          htmlContent: rendered.htmlContent,
          textContent: rendered.textContent,
          attachments: rendered.attachments,
          messageId: `<voucher-${claim.job.id}-${item.id}-${item.attempt_count}@jpulse>`,
        });
        await completeMarketingVoucherEmailItem({
          job_id: claim.job.id,
          item_id: item.id,
          attempt_count: item.attempt_count,
          success: true,
          message_id: result.messageId,
          error_code: null,
          error_message: null,
        });
      } catch (error) {
        const failure = errorDetails(error);
        await completeMarketingVoucherEmailItem({
          job_id: claim.job.id,
          item_id: item.id,
          attempt_count: item.attempt_count,
          success: false,
          message_id: null,
          error_code: failure.code,
          error_message: failure.message,
        });
      }
    }),
  );
  const job = await findMarketingVoucherJobById(jobId);
  if (!job) throw new Error("MARKETING_VOUCHER_JOB_NOT_FOUND");
  const shouldDispatch =
    job.status === "PROCESSING" && job.progress.processed < job.progress.total;
  return { job, should_dispatch: shouldDispatch, no_op: false };
};
