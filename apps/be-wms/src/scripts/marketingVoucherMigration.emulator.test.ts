import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import type { MigrationFirebaseClients } from "./marketingVoucherMigrationFirebase.js";
import { runMarketingVoucherMigration } from "./marketingVoucherMigrationService.js";

const campaign = (id: string, purpose?: "event" | "print") => ({
  id,
  name: `Campaign ${id}`,
  description: "Migration fixture",
  rewardType: "discount_percent",
  rewardValue: 10,
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  prefix: "JP",
  codeLength: 6,
  suffix: "26",
  totalIssued: 999,
  status: "active",
  ...(purpose ? { purpose } : {}),
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "legacy-owner",
});

test("phase 6 apply reconciles counts, writes audit and redacts staging PII", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const sourceApp = initializeApp(
    { projectId: `legacy-${suffix}` },
    `source-${suffix}`,
  );
  const targetApp = initializeApp(
    { projectId: `staging-${suffix}` },
    `target-${suffix}`,
  );
  const source = getFirestore(sourceApp);
  const target = getFirestore(targetApp);
  const campaignSizes = [1, 2, 3];
  for (let index = 0; index < campaignSizes.length; index += 1) {
    const campaignId = `campaign-${index + 1}`;
    await source
      .collection("voucher_campaigns")
      .doc(campaignId)
      .set(campaign(campaignId, index === 0 ? undefined : "event"));
    for (let codeIndex = 0; codeIndex < campaignSizes[index]!; codeIndex += 1) {
      const codeId = `CODE-${index + 1}-${codeIndex + 1}`;
      await source
        .collection("voucher_codes")
        .doc(codeId)
        .set({
          id: codeId,
          campaignId,
          campaignName: `Campaign ${campaignId}`,
          rewardType: "discount_percent",
          rewardValue: 10,
          validTo: "2026-12-31",
          status: codeIndex === 0 ? "used" : "available",
          distributedToPhone: codeIndex === 0 ? "0901234567" : null,
          distributedAt: codeIndex === 0 ? "2026-02-01T00:00:00.000Z" : null,
          usedAt: codeIndex === 0 ? "2026-02-02T00:00:00.000Z" : null,
          usedByStaffId: codeIndex === 0 ? "legacy-staff" : null,
          emailedAt: codeIndex === 0 ? "2026-02-01T00:00:00.000Z" : null,
          emailedTo: codeIndex === 0 ? "customer@example.com" : null,
        });
    }
  }
  await source
    .collection("users")
    .doc("legacy-staff")
    .set({ name: "Legacy Staff" });
  const reportDirectory = join(tmpdir(), `voucher-phase6-${suffix}`);
  const clients = {
    source: {
      app: sourceApp,
      db: source,
      storage: getStorage(sourceApp),
      projectId: `legacy-${suffix}`,
      bucketName: null,
    },
    target: {
      app: targetApp,
      db: target,
      storage: getStorage(targetApp),
      projectId: `staging-${suffix}`,
      bucketName: null,
    },
    close: async () => {
      await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
    },
  } as MigrationFirebaseClients;
  try {
    const result = await runMarketingVoucherMigration(clients, {
      mode: "APPLY",
      migrationId: `phase6-${suffix}`,
      actorId: "phase6-test-runner",
      batchSize: 10,
      sourceProjectConfirmation: `legacy-${suffix}`,
      targetProjectConfirmation: `staging-${suffix}`,
      redactPii: true,
      expectedCampaigns: 3,
      expectedCodes: 6,
      reportDirectory,
    });
    assert.equal(result.report.status, "COMPLETED");
    assert.equal(result.report.source_code_count, 6);
    assert.equal(result.report.target_code_count, 6);
    assert.equal(result.report.uat_passed, true);
    assert.equal(result.report.uat_campaign_ids.length, 3);
    const migratedCampaign = await target
      .collection("marketing_voucher_campaigns")
      .doc("campaign-1")
      .get();
    assert.equal(migratedCampaign.get("purpose"), "EVENT");
    assert.equal(migratedCampaign.get("total_issued"), 1);
    const migratedCode = await target
      .collection("marketing_voucher_codes")
      .doc("CODE-1-1")
      .get();
    assert.match(String(migratedCode.get("distributed_to_phone")), /^phone-/u);
    assert.match(String(migratedCode.get("emailed_to")), /@example\.invalid$/u);
    assert.equal(migratedCode.get("used_by_staff_name"), "[REDACTED]");
    const checkpoint = await target
      .collection("marketing_voucher_migrations")
      .doc(`phase6-${suffix}`)
      .get();
    assert.equal(checkpoint.get("status"), "COMPLETED");
    assert.equal(checkpoint.get("stage"), "COMPLETED");
    const audits = await target
      .collection("audit_logs")
      .where("entity_id", "==", `phase6-${suffix}`)
      .get();
    assert.ok(audits.size >= 3);
  } finally {
    await clients.close();
    await rm(reportDirectory, { recursive: true, force: true });
  }
});
