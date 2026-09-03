import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketingVoucherMigrationReport } from "./marketingVoucherMigrationReportService.js";

const counts = { available: 8, distributed: 1, used: 1, revoked: 0, total: 10 };
const source = {
  campaigns: new Map([
    [
      "campaign-1",
      {
        id: "campaign-1",
        source: { totalIssued: 12, purpose: undefined },
        source_hash: "campaign-hash",
        declared_total: 12,
        counts,
        checksum: "code-checksum",
        image_url: null,
      },
    ],
  ]),
  total: 10,
  checksum: "global-checksum",
  issues: [],
  lastCursor: "CODE-10",
};

test("declared total differences are reported but do not fail a valid dry run", () => {
  const report = buildMarketingVoucherMigrationReport({
    migrationId: "migration-1",
    mode: "DRY_RUN",
    sourceProjectId: "e-commerce-72a4b",
    targetProjectId: null,
    piiRedacted: false,
    expectedCampaigns: 1,
    expectedCodes: 10,
    source,
    target: null,
    images: new Map(),
    uat: null,
    startedAt: new Date("2026-09-03T00:00:00.000Z"),
  });
  assert.equal(report.status, "COMPLETED");
  assert.deepEqual(report.campaigns[0]?.issues, [
    "DECLARED_TOTAL_DIFFERENCE:12:10",
  ]);
});

test("reconciliation fails closed on checksum or UAT differences", () => {
  const report = buildMarketingVoucherMigrationReport({
    migrationId: "migration-1",
    mode: "RECONCILE",
    sourceProjectId: "e-commerce-72a4b",
    targetProjectId: "test-jw-system",
    piiRedacted: true,
    expectedCampaigns: 1,
    expectedCodes: 10,
    source,
    target: {
      campaignCount: 1,
      codeCount: 10,
      checksum: "different",
      campaignCounts: { "campaign-1": counts },
      campaignChecksums: { "campaign-1": "different" },
      campaignSourceHashes: { "campaign-1": "campaign-hash" },
      issues: [],
    },
    images: new Map(),
    uat: {
      campaignIds: ["campaign-1"],
      passed: false,
      issues: ["UAT_PHONE_NOT_REDACTED:CODE-1"],
    },
    startedAt: new Date("2026-09-03T00:00:00.000Z"),
  });
  assert.equal(report.status, "FAILED");
  assert.ok(report.issues.includes("TARGET_GLOBAL_CHECKSUM_MISMATCH"));
  assert.ok(report.issues.includes("UAT_PHONE_NOT_REDACTED:CODE-1"));
});
