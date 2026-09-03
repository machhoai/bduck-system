import type {
  CreateMarketingVoucherExportDownloadInput,
  CreateMarketingVoucherExportJobInput,
  MarketingVoucherExportDownload,
} from "@bduck/shared-types";

import { recordMarketingVoucherExportDownload } from "../repositories/marketingVoucherExportAuditRepository.js";
import { createMarketingVoucherExportJobRecord } from "../repositories/marketingVoucherExportJobRepository.js";
import { findMarketingVoucherJobById } from "../repositories/marketingVoucherQueryRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import { assertMarketingVoucherPermission } from "./marketingVoucherAccessPolicy.js";
import { createMarketingVoucherSignedUrl } from "./marketingVoucherExportStorageService.js";
import {
  marketingVoucherOperationContext,
  type MarketingVoucherRequestMetadata,
} from "./marketingVoucherOperationContext.js";
import { dispatchMarketingVoucherJob } from "./marketingVoucherTaskDispatcher.js";

export async function createMarketingVoucherExport(
  request: CreateMarketingVoucherExportJobInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.export");
  const result = await createMarketingVoucherExportJobRecord({
    campaign_id: request.campaign_id,
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
}

export async function createMarketingVoucherExportDownload(
  jobId: string,
  request: CreateMarketingVoucherExportDownloadInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
): Promise<MarketingVoucherExportDownload> {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.export");
  const job = await findMarketingVoucherJobById(jobId);
  if (
    !job ||
    job.type !== "EXPORT_EXCEL" ||
    job.status !== "COMPLETED" ||
    !job.output_storage_path ||
    !job.output_file_name ||
    !job.output_content_type ||
    !job.output_checksum ||
    !job.export_manifest
  ) {
    throw {
      code: "MARKETING_VOUCHER_EXPORT_NOT_READY",
      statusCode: 409,
      messages: {
        vi: "File xuất chưa sẵn sàng để tải xuống.",
        zh: "导出文件尚未准备好下载。",
      },
    };
  }
  const context = marketingVoucherOperationContext({
    actorId,
    actionTime: request.action_time,
    idempotencyKey: request.idempotency_key,
    metadata,
  });
  const signed = await createMarketingVoucherSignedUrl(
    job.output_storage_path,
    job.output_file_name,
  );
  await recordMarketingVoucherExportDownload({ job_id: jobId, context });
  return {
    ...signed,
    file_name: job.output_file_name,
    content_type: job.output_content_type,
    checksum: job.output_checksum,
    manifest: job.export_manifest,
  };
}
