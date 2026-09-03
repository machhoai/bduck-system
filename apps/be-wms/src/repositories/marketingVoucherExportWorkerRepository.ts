import { randomUUID } from "node:crypto";

import {
  AuditAction,
  MARKETING_VOUCHER_CODES_COLLECTION,
  type MarketingVoucherExportManifest,
  type MarketingVoucherExportPart,
  type MarketingVoucherJob,
} from "@bduck/shared-types";
import { FieldPath } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import {
  marketingVoucherExportManifestPath,
  marketingVoucherExportOutputPath,
  marketingVoucherExportPartPath,
} from "../services/marketingVoucherExportStorageService.js";
import {
  defaultMarketingVoucherExportWorkerDependencies,
  type MarketingVoucherExportWorkerDependencies,
} from "../services/marketingVoucherExportWorkerDependencies.js";

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

const configuredPartSize = () =>
  Math.min(
    5_000,
    Math.max(
      1,
      Number(process.env.MARKETING_VOUCHER_EXPORT_ROWS_PER_WORKBOOK ?? 2_000),
    ),
  );

const configuredQrConcurrency = () =>
  Math.min(
    24,
    Math.max(1, Number(process.env.MARKETING_VOUCHER_QR_CONCURRENCY ?? 8)),
  );

const loadCodes = async (job: MarketingVoucherJob, limit: number) => {
  let query: FirebaseFirestore.Query = db
    .collection(MARKETING_VOUCHER_CODES_COLLECTION)
    .where("campaign_id", "==", job.campaign_id)
    .where("is_deleted", "==", false)
    .orderBy(FieldPath.documentId())
    .limit(limit);
  if (job.cursor) query = query.startAfter(job.cursor);
  return query.get();
};

const exportContext = (
  job: MarketingVoucherJob,
): MarketingVoucherOperationContext => ({
  actor_id: job.requested_by,
  action_time: job.action_time,
  idempotency_key: job.idempotency_key,
});

const outputName = (campaignName: string, zipped: boolean) => {
  const safeName =
    campaignName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^A-Za-z0-9_-]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 60) || "campaign";
  return `${safeName}-vouchers.${zipped ? "zip" : "xlsx"}`;
};

async function finalizeExport(
  initialJob: MarketingVoucherJob,
  dependencies: MarketingVoucherExportWorkerDependencies,
): Promise<MarketingVoucherWorkerResult> {
  const campaignSnapshot = await campaignRef(initialJob.campaign_id).get();
  if (!campaignSnapshot.exists)
    throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
  const campaign = mapMarketingVoucherCampaign(campaignSnapshot);
  const zipped = initialJob.export_parts.length > 1;
  const fileName = outputName(campaign.name, zipped);
  const attemptToken = randomUUID();
  const outputPath = marketingVoucherExportOutputPath(
    initialJob.id,
    attemptToken,
    fileName,
  );
  const manifest: MarketingVoucherExportManifest = {
    version: 1,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    job_id: initialJob.id,
    locale: initialJob.export_locale ?? "vi",
    generated_at: new Date(),
    total_rows: initialJob.progress.succeeded,
    part_count: initialJob.export_parts.length,
    format: zipped ? "ZIP" : "XLSX",
    files: initialJob.export_parts,
  };
  const manifestPath = marketingVoucherExportManifestPath(
    initialJob.id,
    attemptToken,
  );
  await dependencies.saveManifest(manifestPath, manifest);
  let output: { checksum: string; size_bytes: number };
  if (zipped) {
    output = await dependencies.createZip({ outputPath, manifest });
  } else {
    const [part] = initialJob.export_parts;
    if (!part) throw new Error("MARKETING_VOUCHER_EXPORT_PART_MISSING");
    await dependencies.copyFile(part.storage_path, outputPath);
    output = { checksum: part.checksum, size_bytes: part.size_bytes };
  }
  return db.runTransaction(async (transaction) => {
    const [jobSnapshot, currentCampaignSnapshot] = await Promise.all([
      transaction.get(jobRef(initialJob.id)),
      transaction.get(campaignRef(initialJob.campaign_id)),
    ]);
    if (!jobSnapshot.exists || !currentCampaignSnapshot.exists) {
      throw new Error("MARKETING_VOUCHER_EXPORT_STATE_NOT_FOUND");
    }
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    const previousCampaign = mapMarketingVoucherCampaign(
      currentCampaignSnapshot,
    );
    if (
      previousJob.revision !== initialJob.revision ||
      previousJob.status === "PAUSED" ||
      previousCampaign.status === "PAUSED"
    ) {
      return { job: previousJob, should_dispatch: false, no_op: true };
    }
    const now = new Date();
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: "COMPLETED",
      output_storage_path: outputPath,
      output_checksum: output.checksum,
      output_file_name: fileName,
      output_content_type: zipped
        ? "application/zip"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      output_size_bytes: output.size_bytes,
      output_manifest_storage_path: manifestPath,
      export_manifest: manifest,
      completed_at: now,
      attempt_count: previousJob.attempt_count + 1,
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    const updatedCampaign = {
      ...previousCampaign,
      active_export_job_id: null,
      revision: previousCampaign.revision + 1,
      updated_by: previousJob.requested_by,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(jobSnapshot.ref, updatedJob);
    transaction.set(currentCampaignSnapshot.ref, updatedCampaign);
    writeMarketingVoucherAudit(transaction, {
      id: `${previousJob.id}:export:complete`,
      action: AuditAction.MARKETING_VOUCHER_EXPORT_COMPLETE,
      entity_type: "marketing_voucher_jobs",
      entity_id: previousJob.id,
      entity_name: previousCampaign.name,
      context: exportContext(previousJob),
      old_value: previousJob,
      new_value: updatedJob,
      sync_time: now,
      notes: `Published voucher export with ${manifest.total_rows} rows`,
    });
    return { job: updatedJob, should_dispatch: false, no_op: false };
  });
}

export async function processMarketingVoucherExportChunk(
  jobId: string,
  dependencies = defaultMarketingVoucherExportWorkerDependencies,
  options: { partSize?: number; qrConcurrency?: number } = {},
): Promise<MarketingVoucherWorkerResult> {
  const snapshot = await jobRef(jobId).get();
  if (!snapshot.exists) throw new Error("MARKETING_VOUCHER_JOB_NOT_FOUND");
  const initialJob = mapMarketingVoucherJob(snapshot);
  if (
    initialJob.type !== "EXPORT_EXCEL" ||
    ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED", "PAUSED"].includes(
      initialJob.status,
    )
  ) {
    return { job: initialJob, should_dispatch: false, no_op: true };
  }
  if (initialJob.progress.succeeded >= initialJob.progress.total) {
    return finalizeExport(initialJob, dependencies);
  }
  const limit = Math.min(
    options.partSize ?? configuredPartSize(),
    initialJob.progress.total - initialJob.progress.succeeded,
  );
  const candidates = await loadCodes(initialJob, limit);
  if (candidates.size !== limit) {
    throw new Error("MARKETING_VOUCHER_EXPORT_COUNT_MISMATCH");
  }
  const campaignSnapshot = await campaignRef(initialJob.campaign_id).get();
  if (!campaignSnapshot.exists)
    throw new Error("MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND");
  const campaign = mapMarketingVoucherCampaign(campaignSnapshot);
  const partIndex = initialJob.export_parts.length + 1;
  const buffer = await dependencies.createWorkbook({
    campaignName: campaign.name,
    codes: candidates.docs.map(mapMarketingVoucherCode),
    locale: initialJob.export_locale ?? "vi",
    qrConcurrency: options.qrConcurrency ?? configuredQrConcurrency(),
  });
  const storagePath = marketingVoucherExportPartPath(
    jobId,
    partIndex,
    randomUUID(),
  );
  const stored = await dependencies.saveFile(
    storagePath,
    buffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  return db.runTransaction(async (transaction) => {
    const [jobSnapshot, currentCampaignSnapshot] = await Promise.all([
      transaction.get(jobRef(jobId)),
      transaction.get(campaignRef(initialJob.campaign_id)),
    ]);
    if (!jobSnapshot.exists || !currentCampaignSnapshot.exists) {
      throw new Error("MARKETING_VOUCHER_EXPORT_STATE_NOT_FOUND");
    }
    const previousJob = mapMarketingVoucherJob(jobSnapshot);
    const previousCampaign = mapMarketingVoucherCampaign(
      currentCampaignSnapshot,
    );
    if (
      previousJob.revision !== initialJob.revision ||
      previousJob.status === "PAUSED" ||
      previousCampaign.status === "PAUSED"
    ) {
      return { job: previousJob, should_dispatch: false, no_op: true };
    }
    const now = new Date();
    const part: MarketingVoucherExportPart = {
      index: partIndex,
      file_name: `vouchers-${String(partIndex).padStart(5, "0")}.xlsx`,
      storage_path: stored.path,
      row_count: candidates.size,
      checksum: stored.checksum,
      size_bytes: stored.size_bytes,
    };
    const succeeded = previousJob.progress.succeeded + candidates.size;
    const updatedJob: MarketingVoucherJob = {
      ...previousJob,
      status: "PROCESSING",
      cursor: candidates.docs.at(-1)?.id ?? previousJob.cursor,
      progress: {
        total: previousJob.progress.total,
        processed: succeeded,
        succeeded,
        failed: 0,
      },
      export_parts: [...previousJob.export_parts, part],
      attempt_count: previousJob.attempt_count + 1,
      revision: previousJob.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(jobSnapshot.ref, updatedJob);
    writeMarketingVoucherAudit(transaction, {
      id: `${previousJob.id}:export:part:${partIndex}`,
      action: AuditAction.MARKETING_VOUCHER_EXPORT_PART_CREATE,
      entity_type: "marketing_voucher_jobs",
      entity_id: previousJob.id,
      entity_name: previousCampaign.name,
      context: exportContext(previousJob),
      old_value: previousJob,
      new_value: updatedJob,
      sync_time: now,
      notes: `Stored export part ${partIndex} with ${part.row_count} rows`,
    });
    return { job: updatedJob, should_dispatch: true, no_op: false };
  });
}
