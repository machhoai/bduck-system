import type { ResumeMarketingVoucherJobInput } from "@bduck/shared-types";

import { failMarketingVoucherEmailJob } from "../repositories/marketingVoucherEmailFailureRepository.js";
import { failMarketingVoucherExportJob } from "../repositories/marketingVoucherExportFailureRepository.js";
import { processMarketingVoucherExportChunk } from "../repositories/marketingVoucherExportWorkerRepository.js";
import {
  failMarketingVoucherExtensionJob,
  processMarketingVoucherExtensionChunk,
} from "../repositories/marketingVoucherExtensionWorkerRepository.js";
import {
  failMarketingVoucherGenerationJob,
  processMarketingVoucherGenerationChunk,
} from "../repositories/marketingVoucherGenerationWorkerRepository.js";
import {
  findMarketingVoucherJobById,
  listMarketingVoucherJobs,
} from "../repositories/marketingVoucherQueryRepository.js";
import { resumeMarketingVoucherJobRecord } from "../repositories/marketingVoucherResumeJobRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import { assertMarketingVoucherPermission } from "./marketingVoucherAccessPolicy.js";
import { processMarketingVoucherEmailChunk } from "./marketingVoucherEmailService.js";
import {
  marketingVoucherOperationContext,
  type MarketingVoucherRequestMetadata,
} from "./marketingVoucherOperationContext.js";
import { dispatchMarketingVoucherJob } from "./marketingVoucherTaskDispatcher.js";

const requireJob = async (jobId: string) => {
  const job = await findMarketingVoucherJobById(jobId);
  if (!job) {
    throw {
      code: "MARKETING_VOUCHER_JOB_NOT_FOUND",
      statusCode: 404,
      messages: { vi: "Không tìm thấy job voucher.", zh: "未找到优惠券任务。" },
    };
  }
  return job;
};

export const getMarketingVoucherJobs = async (
  query: {
    campaign_id?: string;
    status?: string;
    type?: string;
    cursor?: string;
    limit: number;
  },
  authorization: AuthorizationService,
) => {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.read");
  return listMarketingVoucherJobs(query);
};

export const getMarketingVoucherJob = async (
  jobId: string,
  authorization: AuthorizationService,
) => {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.read");
  return requireJob(jobId);
};

export const resumeMarketingVoucherJob = async (
  jobId: string,
  request: ResumeMarketingVoucherJobInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  const job = await requireJob(jobId);
  if (job.type === "SEND_EMAIL" && job.status !== "PAUSED") {
    throw {
      code: "MARKETING_VOUCHER_EMAIL_RETRY_ITEMS_REQUIRED",
      statusCode: 409,
      messages: {
        vi: "Hãy chọn các email lỗi cần gửi lại.",
        zh: "请选择要重试的失败邮件项目。",
      },
    };
  }
  const permission =
    job.type === "GENERATE_CODES"
      ? "marketing_vouchers.codes.generate"
      : job.type === "EXTEND_EXPIRY"
        ? "marketing_vouchers.campaigns.extend"
        : job.type === "EXPORT_EXCEL"
          ? "marketing_vouchers.export"
          : "marketing_vouchers.email.send";
  assertMarketingVoucherPermission(authorization, permission);
  const result = await resumeMarketingVoucherJobRecord({
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

const failureOf = (error: unknown) => ({
  code:
    (error as { code?: string }).code ??
    (error instanceof Error
      ? error.message
      : "MARKETING_VOUCHER_WORKER_FAILED"),
  message: error instanceof Error ? error.message : String(error),
});

export const processMarketingVoucherJob = async (jobId: string) => {
  const job = await requireJob(jobId);
  try {
    const result =
      job.type === "GENERATE_CODES"
        ? await processMarketingVoucherGenerationChunk(jobId)
        : job.type === "EXTEND_EXPIRY"
          ? await processMarketingVoucherExtensionChunk(jobId)
          : job.type === "SEND_EMAIL"
            ? await processMarketingVoucherEmailChunk(jobId)
            : await processMarketingVoucherExportChunk(jobId);
    if (result.should_dispatch && result.job) {
      await dispatchMarketingVoucherJob({
        jobId: result.job.id,
        revision: result.job.revision,
      });
    }
    return result;
  } catch (error) {
    const failure = failureOf(error);
    if (job.type === "GENERATE_CODES") {
      await failMarketingVoucherGenerationJob(jobId, failure);
    } else if (job.type === "EXTEND_EXPIRY") {
      await failMarketingVoucherExtensionJob(jobId, failure);
    } else if (job.type === "SEND_EMAIL") {
      await failMarketingVoucherEmailJob(jobId, failure);
    } else if (job.type === "EXPORT_EXCEL") {
      await failMarketingVoucherExportJob(jobId, failure);
    }
    throw error;
  }
};
