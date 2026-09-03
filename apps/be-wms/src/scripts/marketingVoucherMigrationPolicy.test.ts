import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalHash,
  transformLegacyCampaign,
  transformLegacyCode,
} from "./marketingVoucherMigrationPolicy.js";

const campaign = {
  name: "Print campaign",
  description: "Legacy",
  rewardType: "free_ticket",
  rewardValue: 1,
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  prefix: "jp",
  codeLength: 8,
  suffix: "26",
  totalIssued: 1_000_000,
  status: "paused",
  createdAt: "2026-01-01T01:00:00.000Z",
  createdBy: "legacy-user-1",
};

test("campaign transform defaults missing purpose and uses actual counts", () => {
  const transformed = transformLegacyCampaign({
    id: "campaign-1",
    source: campaign,
    migrationId: "migration-1",
    sourceProjectId: "e-commerce-72a4b",
    actorId: "phase6-runner",
    syncTime: new Date("2026-09-03T00:00:00.000Z"),
    counts: { available: 7, distributed: 2, used: 1, revoked: 0, total: 10 },
    redactPii: true,
  });
  assert.equal(transformed.purpose, "EVENT");
  assert.equal(transformed.status, "PAUSED");
  assert.equal(transformed.total_issued, 10);
  assert.equal(transformed.legacy_metadata?.source_total_issued, 1_000_000);
  assert.equal(transformed.legacy_metadata?.purpose_defaulted, true);
  assert.match(transformed.legacy_metadata?.source_actor_id ?? "", /^staff-/u);
});

test("code transform keeps lifecycle and deterministically redacts PII", () => {
  const source = {
    campaignId: "campaign-1",
    campaignName: "Print campaign",
    rewardType: "discount_percent",
    rewardValue: 10,
    validTo: "2026-12-31",
    status: "used",
    distributedToPhone: "0901234567",
    distributedAt: "2026-02-01T00:00:00.000Z",
    usedAt: "2026-02-02T00:00:00.000Z",
    usedByStaffId: "staff-real-id",
    emailedAt: "2026-02-01T00:00:00.000Z",
    emailedTo: "person@example.com",
  };
  const first = transformLegacyCode({
    id: "JP-ABC-26",
    source,
    migrationId: "migration-1",
    sourceProjectId: "e-commerce-72a4b",
    actorId: "phase6-runner",
    syncTime: new Date("2026-09-03T00:00:00.000Z"),
    staffName: "Real Person",
    redactPii: true,
  });
  const second = transformLegacyCode({
    id: "JP-ABC-26",
    source,
    migrationId: "migration-1",
    sourceProjectId: "e-commerce-72a4b",
    actorId: "phase6-runner",
    syncTime: new Date("2026-09-04T00:00:00.000Z"),
    staffName: "Real Person",
    redactPii: true,
  });
  assert.equal(first.code.status, "USED");
  assert.match(first.code.distributed_to_phone ?? "", /^phone-/u);
  assert.match(first.code.emailed_to ?? "", /@example\.invalid$/u);
  assert.match(first.code.used_by_staff_id ?? "", /^staff-/u);
  assert.equal(first.code.used_by_staff_name, "[REDACTED]");
  assert.equal(first.source_hash, second.source_hash);
  assert.equal(
    first.source_hash,
    canonicalHash({ ...source, id: "JP-ABC-26" }),
  );
});

test("legacy expired is represented as effective expiry without lifecycle overwrite", () => {
  const result = transformLegacyCode({
    id: "EXPIRED-1",
    source: {
      campaignId: "campaign-1",
      rewardType: "free_item",
      rewardValue: 1,
      validTo: "2020-01-01",
      status: "expired",
    },
    migrationId: "migration-1",
    sourceProjectId: "e-commerce-72a4b",
    actorId: "phase6-runner",
    syncTime: new Date("2026-09-03T00:00:00.000Z"),
    staffName: null,
    redactPii: false,
  });
  assert.equal(result.code.status, "AVAILABLE");
  assert.equal(result.issue, "LEGACY_EXPIRED_MAPPED_TO_AVAILABLE");
});
