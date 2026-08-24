import assert from "node:assert/strict";
import test from "node:test";

import type { sendBrevoEmail } from "../services/brevoEmailService.js";

const errorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;

test(
  "voucher email jobs pause, report partial results and retry only failures",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [
      { db },
      { createMarketingVoucherCampaignRecord },
      { processMarketingVoucherGenerationChunk },
      { updateMarketingVoucherAppearanceRecord },
      { createMarketingVoucherEmailJobRecord },
      { retryMarketingVoucherEmailItemsRecord },
      { processMarketingVoucherEmailChunk },
      { changeMarketingVoucherCampaignStatusRecord },
      { resumeMarketingVoucherJobRecord },
    ] = await Promise.all([
      import("../config/firebase.js"),
      import("./marketingVoucherCampaignMutationRepository.js"),
      import("./marketingVoucherGenerationWorkerRepository.js"),
      import("./marketingVoucherAppearanceRepository.js"),
      import("./marketingVoucherEmailJobRepository.js"),
      import("./marketingVoucherEmailRetryRepository.js"),
      import("../services/marketingVoucherEmailService.js"),
      import("./marketingVoucherCampaignStatusRepository.js"),
      import("./marketingVoucherResumeJobRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const actorId = `email-actor-${suffix}`;
    const actionTime = new Date();
    const context = (key: string) => ({
      actor_id: actorId,
      action_time: actionTime,
      idempotency_key: `${key}-${suffix}`,
      ip_address: "127.0.0.1",
    });
    const created = await createMarketingVoucherCampaignRecord({
      campaign: {
        name: `Email test ${suffix}`,
        description: "Phase 4 emulator",
        reward_type: "DISCOUNT_PERCENT",
        reward_value: 20,
        valid_from: "2026-08-20",
        valid_to: "2026-12-31",
        prefix: "EM",
        code_length: 10,
        suffix: "",
        purpose: "EVENT",
        accent_color: "#F5C542",
        requested_code_count: 4,
        idempotency_key: `create-${suffix}`,
        action_time: actionTime,
      },
      context: context("create"),
    });
    await processMarketingVoucherGenerationChunk(created.job!.id, 10);
    let campaignDoc = await db
      .collection("marketing_voucher_campaigns")
      .doc(created.campaign.id)
      .get();
    const appearance = await updateMarketingVoucherAppearanceRecord({
      campaign_id: created.campaign.id,
      request: {
        accent_color: "#f97316",
        expected_revision: campaignDoc.get("revision"),
        idempotency_key: `appearance-${suffix}`,
        action_time: actionTime,
      },
      context: context("appearance"),
    });
    assert.equal(appearance.campaign.accent_color, "#F97316");

    const codeSnapshot = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", created.campaign.id)
      .get();
    const codeIds = codeSnapshot.docs.map((document) => document.id);
    assert.equal(codeIds.length, 4);
    const recipients = codeIds.map((codeId, index) => ({
      email: index === 0 ? "fail@example.com" : `ok-${index}@example.com`,
      voucher_code_ids: [codeId],
    }));
    const emailJob = await createMarketingVoucherEmailJobRecord({
      request: {
        campaign_id: created.campaign.id,
        recipients,
        subject: "Your JPULSE voucher",
        introduction: "Welcome",
        idempotency_key: `email-${suffix}`,
        action_time: actionTime,
      },
      context: context("email"),
    });
    const sentTo: string[] = [];
    let simulateFailure = true;
    const fakeSend = async (
      input: Parameters<typeof sendBrevoEmail>[0],
    ): ReturnType<typeof sendBrevoEmail> => {
      const recipient = input.to[0] ?? "";
      sentTo.push(recipient);
      if (simulateFailure && recipient === "fail@example.com") {
        throw new Error("SIMULATED_BREVO_FAILURE");
      }
      return { messageId: `message-${sentTo.length}` };
    };

    const firstChunk = await processMarketingVoucherEmailChunk(
      emailJob.job!.id,
      fakeSend,
    );
    assert.equal(firstChunk.job?.progress.processed, 3);
    campaignDoc = await db
      .collection("marketing_voucher_campaigns")
      .doc(created.campaign.id)
      .get();
    const paused = await changeMarketingVoucherCampaignStatusRecord({
      campaign_id: created.campaign.id,
      request: {
        status: "PAUSED",
        expected_revision: campaignDoc.get("revision"),
        idempotency_key: `pause-${suffix}`,
        action_time: actionTime,
      },
      context: context("pause"),
    });
    const sendsBeforePauseCheck = sentTo.length;
    await processMarketingVoucherEmailChunk(emailJob.job!.id, fakeSend);
    assert.equal(sentTo.length, sendsBeforePauseCheck);
    const pausedJobDoc = await db
      .collection("marketing_voucher_jobs")
      .doc(emailJob.job!.id)
      .get();
    assert.equal(pausedJobDoc.get("status"), "PAUSED");
    await assert.rejects(
      createMarketingVoucherEmailJobRecord({
        request: {
          campaign_id: created.campaign.id,
          recipients: [recipients[0]!],
          subject: "Blocked",
          introduction: "Paused",
          idempotency_key: `blocked-${suffix}`,
          action_time: actionTime,
        },
        context: context("blocked"),
      }),
      (error) => errorCode(error) === "MARKETING_VOUCHER_CAMPAIGN_PAUSED",
    );

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
    const resumed = await resumeMarketingVoucherJobRecord({
      job_id: emailJob.job!.id,
      request: {
        expected_job_revision: pausedJobDoc.get("revision"),
        expected_campaign_revision: activated.campaign.revision,
        idempotency_key: `resume-${suffix}`,
        action_time: actionTime,
      },
      context: context("resume"),
    });
    assert.equal(resumed.job?.status, "QUEUED");
    await processMarketingVoucherEmailChunk(emailJob.job!.id, fakeSend);
    let finishedJobDoc = await db
      .collection("marketing_voucher_jobs")
      .doc(emailJob.job!.id)
      .get();
    assert.equal(finishedJobDoc.get("status"), "PARTIAL");

    const failedItems = await db
      .collection("marketing_voucher_jobs")
      .doc(emailJob.job!.id)
      .collection("items")
      .where("status", "==", "FAILED")
      .get();
    assert.equal(failedItems.size, 1);
    await retryMarketingVoucherEmailItemsRecord({
      job_id: emailJob.job!.id,
      request: {
        job_id: emailJob.job!.id,
        item_ids: failedItems.docs.map((document) => document.id),
        idempotency_key: `retry-${suffix}`,
        action_time: actionTime,
      },
      context: context("retry"),
    });
    simulateFailure = false;
    await processMarketingVoucherEmailChunk(emailJob.job!.id, fakeSend);
    finishedJobDoc = await db
      .collection("marketing_voucher_jobs")
      .doc(emailJob.job!.id)
      .get();
    assert.equal(finishedJobDoc.get("status"), "COMPLETED");
    assert.equal(finishedJobDoc.get("progress.succeeded"), 4);
    assert.equal(
      sentTo.filter((email) => email === "fail@example.com").length,
      2,
    );
    assert.equal(sentTo.length, 5);

    const emailedCodes = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", created.campaign.id)
      .get();
    emailedCodes.forEach((document) => {
      assert.equal(document.get("status"), "AVAILABLE");
      assert.ok(document.get("emailed_at"));
      assert.ok(document.get("emailed_to"));
    });
    const dispatches = await db
      .collection("notification_dispatches")
      .where("created_by", "==", actorId)
      .get();
    assert.equal(dispatches.size, 5);
    const audits = await db
      .collection("audit_logs")
      .where("entity_id", "==", emailJob.job!.id)
      .get();
    assert.ok(audits.size >= 7);
  },
);
