import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { MarketingVoucherExportWorkerDependencies } from "../services/marketingVoucherExportWorkerDependencies.js";

const errorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;

test(
  "voucher export jobs are idempotent, print-only, pause-safe and resumable",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [
      { db },
      { createMarketingVoucherCampaignRecord },
      { processMarketingVoucherGenerationChunk },
      { createMarketingVoucherExportJobRecord },
      { changeMarketingVoucherCampaignStatusRecord },
      { processMarketingVoucherExportChunk },
      { failMarketingVoucherExportJob },
      { resumeMarketingVoucherJobRecord },
    ] = await Promise.all([
      import("../config/firebase.js"),
      import("./marketingVoucherCampaignMutationRepository.js"),
      import("./marketingVoucherGenerationWorkerRepository.js"),
      import("./marketingVoucherExportJobRepository.js"),
      import("./marketingVoucherCampaignStatusRepository.js"),
      import("./marketingVoucherExportWorkerRepository.js"),
      import("./marketingVoucherExportFailureRepository.js"),
      import("./marketingVoucherResumeJobRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const actionTime = new Date();
    const context = (key: string) => ({
      actor_id: `export-actor-${suffix}`,
      action_time: actionTime,
      idempotency_key: `${key}-${suffix}`,
      ip_address: "127.0.0.1",
    });
    const created = await createMarketingVoucherCampaignRecord({
      campaign: {
        name: `Print export ${suffix}`,
        description: "Phase 5 emulator",
        reward_type: "FREE_TICKET",
        reward_value: 0,
        valid_from: "2026-09-01",
        valid_to: "2026-12-31",
        prefix: "PRINT",
        code_length: 8,
        suffix: "",
        purpose: "PRINT",
        accent_color: "#F5C542",
        requested_code_count: 3,
        idempotency_key: `create-${suffix}`,
        action_time: actionTime,
      },
      context: context("create"),
    });
    await processMarketingVoucherGenerationChunk(created.job!.id, 10);
    let campaign = await db
      .collection("marketing_voucher_campaigns")
      .doc(created.campaign.id)
      .get();
    const exportRequest = {
      campaign_id: created.campaign.id,
      locale: "vi" as const,
      expected_revision: campaign.get("revision") as number,
      idempotency_key: `export-${suffix}`,
      action_time: actionTime,
    };
    const queued = await createMarketingVoucherExportJobRecord({
      campaign_id: created.campaign.id,
      request: exportRequest,
      context: context("export"),
    });
    const replayed = await createMarketingVoucherExportJobRecord({
      campaign_id: created.campaign.id,
      request: exportRequest,
      context: context("export"),
    });
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.job?.id, queued.job?.id);
    assert.equal(queued.job?.progress.total, 3);

    const paused = await changeMarketingVoucherCampaignStatusRecord({
      campaign_id: created.campaign.id,
      request: {
        status: "PAUSED",
        expected_revision: queued.campaign.revision,
        idempotency_key: `pause-${suffix}`,
        action_time: actionTime,
      },
      context: context("pause"),
    });
    assert.equal(paused.job?.status, "PAUSED");
    const noOp = await processMarketingVoucherExportChunk(queued.job!.id);
    assert.equal(noOp.no_op, true);
    assert.equal(noOp.job.progress.succeeded, 0);

    const activated = await changeMarketingVoucherCampaignStatusRecord({
      campaign_id: created.campaign.id,
      request: {
        status: "ACTIVE",
        expected_revision: paused.campaign.revision,
        idempotency_key: `activate-${suffix}`,
        action_time: actionTime,
      },
      context: context("activate"),
    });
    assert.equal(activated.job?.status, "QUEUED");
    await failMarketingVoucherExportJob(queued.job!.id, {
      code: "SIMULATED_EXPORT_FAILURE",
      message: "Simulated retry path",
    });
    const failedJob = await db
      .collection("marketing_voucher_jobs")
      .doc(queued.job!.id)
      .get();
    campaign = await db
      .collection("marketing_voucher_campaigns")
      .doc(created.campaign.id)
      .get();
    const resumed = await resumeMarketingVoucherJobRecord({
      job_id: queued.job!.id,
      request: {
        expected_job_revision: failedJob.get("revision"),
        expected_campaign_revision: campaign.get("revision"),
        idempotency_key: `resume-${suffix}`,
        action_time: actionTime,
      },
      context: context("resume"),
    });
    assert.equal(resumed.job?.status, "QUEUED");
    assert.equal(resumed.campaign.active_export_job_id, queued.job?.id);
    const stored = new Map<string, Buffer>();
    const save = async (path: string, buffer: Buffer) => {
      stored.set(path, buffer);
      return {
        path,
        checksum: createHash("sha256").update(buffer).digest("hex"),
        size_bytes: buffer.byteLength,
      };
    };
    const dependencies: MarketingVoucherExportWorkerDependencies = {
      createWorkbook: async ({ codes }) =>
        Buffer.from(codes.map((code) => code.id).join("\n")),
      saveFile: (path, buffer) => save(path, buffer),
      saveManifest: (path, manifest) =>
        save(path, Buffer.from(JSON.stringify(manifest))),
      createZip: ({ outputPath, manifest }) =>
        save(outputPath, Buffer.from(JSON.stringify(manifest))),
      copyFile: async (sourcePath, outputPath) => {
        stored.set(outputPath, stored.get(sourcePath)!);
      },
    };
    let exportResult = await processMarketingVoucherExportChunk(
      queued.job!.id,
      dependencies,
      { partSize: 2 },
    );
    while (exportResult.should_dispatch) {
      exportResult = await processMarketingVoucherExportChunk(
        queued.job!.id,
        dependencies,
        { partSize: 2 },
      );
    }
    assert.equal(exportResult.job.status, "COMPLETED");
    assert.equal(exportResult.job.export_manifest?.format, "ZIP");
    assert.equal(exportResult.job.export_manifest?.total_rows, 3);
    assert.equal(exportResult.job.export_manifest?.part_count, 2);
    assert.equal(
      exportResult.job.export_manifest?.files.reduce(
        (total, part) => total + part.row_count,
        0,
      ),
      3,
    );
    assert.ok(stored.has(exportResult.job.output_storage_path!));

    const eventCampaign = await createMarketingVoucherCampaignRecord({
      campaign: {
        ...created.campaign,
        name: `Event ${suffix}`,
        purpose: "EVENT",
        requested_code_count: 1,
        idempotency_key: `event-${suffix}`,
        action_time: actionTime,
      },
      context: context("event"),
    });
    await processMarketingVoucherGenerationChunk(eventCampaign.job!.id, 10);
    const eventDoc = await db
      .collection("marketing_voucher_campaigns")
      .doc(eventCampaign.campaign.id)
      .get();
    await assert.rejects(
      createMarketingVoucherExportJobRecord({
        campaign_id: eventCampaign.campaign.id,
        request: {
          campaign_id: eventCampaign.campaign.id,
          locale: "zh",
          expected_revision: eventDoc.get("revision"),
          idempotency_key: `event-export-${suffix}`,
          action_time: actionTime,
        },
        context: context("event-export"),
      }),
      (error) => errorCode(error) === "MARKETING_VOUCHER_EXPORT_PRINT_ONLY",
    );
  },
);
