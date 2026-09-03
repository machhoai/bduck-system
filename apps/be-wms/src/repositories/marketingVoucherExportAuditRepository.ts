import { AuditAction } from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  jobRef,
  mapMarketingVoucherJob,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";

export async function recordMarketingVoucherExportDownload(input: {
  job_id: string;
  context: MarketingVoucherOperationContext;
}) {
  await db.runTransaction(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "DOWNLOAD_EXPORT",
      input.context,
      { job_id: input.job_id },
    );
    if (operation.replay) return;
    const snapshot = await transaction.get(jobRef(input.job_id));
    if (!snapshot.exists || snapshot.get("is_deleted") === true) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_JOB_NOT_FOUND",
        { vi: "Không tìm thấy job voucher.", zh: "未找到优惠券任务。" },
        404,
      );
    }
    const job = mapMarketingVoucherJob(snapshot);
    if (
      job.type !== "EXPORT_EXCEL" ||
      job.status !== "COMPLETED" ||
      !job.output_storage_path
    ) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_EXPORT_NOT_READY",
        {
          vi: "File xuất chưa sẵn sàng để tải xuống.",
          zh: "导出文件尚未准备好下载。",
        },
        409,
      );
    }
    const campaignSnapshot = await transaction.get(
      campaignRef(job.campaign_id),
    );
    if (
      !campaignSnapshot.exists ||
      campaignSnapshot.get("is_deleted") === true ||
      campaignSnapshot.get("status") !== "ACTIVE"
    ) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_CAMPAIGN_NOT_ACTIVE",
        {
          vi: "Chiến dịch đang tạm dừng hoặc đã kết thúc nên file không thể tải.",
          zh: "活动已暂停或结束，无法下载文件。",
        },
        409,
      );
    }
    const now = new Date();
    writeMarketingVoucherAudit(transaction, {
      id: `${operation.id}:download`,
      action: AuditAction.MARKETING_VOUCHER_EXPORT_DOWNLOAD,
      entity_type: "marketing_voucher_jobs",
      entity_id: job.id,
      entity_name: null,
      context: input.context,
      old_value: null,
      new_value: { output_storage_path: job.output_storage_path },
      sync_time: now,
      notes: "Generated a short-lived voucher export download URL",
    });
    writeMarketingVoucherOperation(
      transaction,
      operation,
      "DOWNLOAD_EXPORT",
      input.context,
      { job_id: job.id },
      now,
    );
  });
}
