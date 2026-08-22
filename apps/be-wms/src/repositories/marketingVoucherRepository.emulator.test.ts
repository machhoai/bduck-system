import assert from "node:assert/strict";
import test from "node:test";

const errorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;

test(
  "voucher jobs keep exact counters, pause, resume, revoke and extension atomic",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [
      { db },
      { createMarketingVoucherCampaignRecord },
      { changeMarketingVoucherCampaignStatusRecord },
      { processMarketingVoucherGenerationChunk, failMarketingVoucherGenerationJob },
      { createMarketingVoucherGenerationJobRecord },
      { revokeMarketingVoucherCodesRecord },
      { createMarketingVoucherExtensionJobRecord },
      { processMarketingVoucherExtensionChunk },
      { resumeMarketingVoucherJobRecord },
    ] = await Promise.all([
      import("../config/firebase.js"),
      import("./marketingVoucherCampaignMutationRepository.js"),
      import("./marketingVoucherCampaignStatusRepository.js"),
      import("./marketingVoucherGenerationWorkerRepository.js"),
      import("./marketingVoucherJobMutationRepository.js"),
      import("./marketingVoucherRevokeRepository.js"),
      import("./marketingVoucherExtensionJobRepository.js"),
      import("./marketingVoucherExtensionWorkerRepository.js"),
      import("./marketingVoucherResumeJobRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const actorId = `voucher-actor-${suffix}`;
    const actionTime = new Date();
    const context = (key: string) => ({
      actor_id: actorId,
      action_time: actionTime,
      idempotency_key: `${key}-${suffix}`,
      ip_address: "127.0.0.1",
    });
    const campaignInput = {
      name: `Voucher test ${suffix}`,
      description: "Phase 2 emulator",
      reward_type: "DISCOUNT_PERCENT" as const,
      reward_value: 20,
      valid_from: "2026-08-20",
      valid_to: "2026-09-20",
      prefix: "JP",
      code_length: 8,
      suffix: "T",
      purpose: "EVENT" as const,
      accent_color: "#F5C542",
      requested_code_count: 5,
      idempotency_key: `create-${suffix}`,
      action_time: actionTime,
    };
    const created = await createMarketingVoucherCampaignRecord({
      campaign: campaignInput,
      context: context("create"),
    });
    const replayed = await createMarketingVoucherCampaignRecord({
      campaign: campaignInput,
      context: context("create"),
    });
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.campaign.id, created.campaign.id);
    assert.ok(created.job);

    const firstChunk = await processMarketingVoucherGenerationChunk(created.job!.id, 2);
    assert.equal(firstChunk.job.progress.succeeded, 2);
    let campaign = (
      await db.collection("marketing_voucher_campaigns").doc(created.campaign.id).get()
    ).data()!;
    assert.equal(campaign.status, "GENERATING");
    assert.equal(campaign.total_issued, 2);
    assert.equal(campaign.code_counts.available, 2);

    const paused = await changeMarketingVoucherCampaignStatusRecord({
      campaign_id: created.campaign.id,
      request: {
        status: "PAUSED",
        expected_revision: campaign.revision,
        idempotency_key: `pause-${suffix}`,
        action_time: actionTime,
      },
      context: context("pause"),
    });
    assert.equal(paused.campaign.status, "PAUSED");
    const pausedWorker = await processMarketingVoucherGenerationChunk(created.job!.id, 2);
    assert.equal(pausedWorker.no_op, true);
    assert.equal(pausedWorker.job.progress.succeeded, 2);

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
    assert.equal(activated.campaign.status, "GENERATING");
    await processMarketingVoucherGenerationChunk(created.job!.id, 10);
    campaign = (
      await db.collection("marketing_voucher_campaigns").doc(created.campaign.id).get()
    ).data()!;
    assert.equal(campaign.status, "ACTIVE");
    assert.equal(campaign.total_issued, 5);
    assert.equal(campaign.code_counts.total, 5);

    const append = await createMarketingVoucherGenerationJobRecord({
      campaign_id: created.campaign.id,
      request: {
        quantity: 2,
        expected_revision: campaign.revision,
        idempotency_key: `append-${suffix}`,
        action_time: actionTime,
      },
      context: context("append"),
    });
    await processMarketingVoucherGenerationChunk(append.job!.id, 10);
    campaign = (
      await db.collection("marketing_voucher_campaigns").doc(created.campaign.id).get()
    ).data()!;
    assert.equal(campaign.total_issued, 7);
    assert.equal(campaign.code_counts.available, 7);

    const codeSnapshot = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", created.campaign.id)
      .limit(2)
      .get();
    const codeIds = codeSnapshot.docs.map((document) => document.id);
    const revoked = await revokeMarketingVoucherCodesRecord({
      request: {
        code_ids: codeIds,
        reason: "Emulator test",
        idempotency_key: `revoke-${suffix}`,
        action_time: actionTime,
      },
      context: context("revoke"),
    });
    assert.deepEqual(revoked.value.revoked_code_ids.sort(), codeIds.sort());
    campaign = (
      await db.collection("marketing_voucher_campaigns").doc(created.campaign.id).get()
    ).data()!;
    assert.equal(campaign.code_counts.available, 5);
    assert.equal(campaign.code_counts.revoked, 2);
    assert.equal(campaign.code_counts.total, 7);

    const extension = await createMarketingVoucherExtensionJobRecord({
      campaign_id: created.campaign.id,
      request: {
        valid_to: "2026-10-20",
        expected_revision: campaign.revision,
        idempotency_key: `extend-${suffix}`,
        action_time: actionTime,
      },
      context: context("extend"),
    });
    let extensionResult = await processMarketingVoucherExtensionChunk(extension.job!.id, 2);
    while (extensionResult.should_dispatch) {
      extensionResult = await processMarketingVoucherExtensionChunk(extension.job!.id, 2);
    }
    assert.equal(extensionResult.job.progress.succeeded, 5);
    campaign = (
      await db.collection("marketing_voucher_campaigns").doc(created.campaign.id).get()
    ).data()!;
    assert.equal(campaign.valid_to, "2026-10-20");
    const extendedCodes = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", created.campaign.id)
      .where("status", "==", "AVAILABLE")
      .get();
    assert.equal(extendedCodes.size, 5);
    extendedCodes.forEach((document) => assert.equal(document.get("valid_to"), "2026-10-20"));

    const failedCampaign = await createMarketingVoucherCampaignRecord({
      campaign: {
        ...campaignInput,
        name: `Resume ${suffix}`,
        requested_code_count: 3,
        idempotency_key: `failed-create-${suffix}`,
      },
      context: context("failed-create"),
    });
    await processMarketingVoucherGenerationChunk(failedCampaign.job!.id, 1);
    await failMarketingVoucherGenerationJob(failedCampaign.job!.id, {
      code: "SIMULATED_FAILURE",
      message: "Simulated failure",
    });
    const [failedCampaignDoc, failedJobDoc] = await Promise.all([
      db.collection("marketing_voucher_campaigns").doc(failedCampaign.campaign.id).get(),
      db.collection("marketing_voucher_jobs").doc(failedCampaign.job!.id).get(),
    ]);
    assert.equal(failedCampaignDoc.get("status"), "GENERATION_FAILED");
    const resumed = await resumeMarketingVoucherJobRecord({
      job_id: failedCampaign.job!.id,
      request: {
        expected_job_revision: failedJobDoc.get("revision"),
        expected_campaign_revision: failedCampaignDoc.get("revision"),
        idempotency_key: `resume-${suffix}`,
        action_time: actionTime,
      },
      context: context("resume"),
    });
    assert.equal(resumed.job?.status, "QUEUED");
    await processMarketingVoucherGenerationChunk(failedCampaign.job!.id, 10);
    const resumedCampaign = await db
      .collection("marketing_voucher_campaigns")
      .doc(failedCampaign.campaign.id)
      .get();
    assert.equal(resumedCampaign.get("status"), "ACTIVE");
    assert.equal(resumedCampaign.get("total_issued"), 3);

    const audits = await db.collection("audit_logs").get();
    assert.ok(
      audits.docs.filter((document) =>
        String(document.get("entity_type")).startsWith("marketing_voucher_"),
      ).length >= 12,
    );

    await assert.rejects(
      createMarketingVoucherGenerationJobRecord({
        campaign_id: created.campaign.id,
        request: {
          quantity: 1,
          expected_revision: 0,
          idempotency_key: `stale-${suffix}`,
          action_time: actionTime,
        },
        context: context("stale"),
      }),
      (error) => errorCode(error) === "MARKETING_VOUCHER_CAMPAIGN_REVISION_CONFLICT",
    );
  },
);
