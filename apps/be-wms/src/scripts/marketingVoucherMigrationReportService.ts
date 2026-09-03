import type {
  MarketingVoucherMigrationMode,
  MarketingVoucherMigrationReport,
} from "@bduck/shared-types";

import type {
  SourceScanResult,
  TargetScanResult,
} from "./marketingVoucherMigrationScanService.js";
import type { MigrationImageResult } from "./marketingVoucherMigrationTypes.js";
import type { MigrationUatResult } from "./marketingVoucherMigrationUatService.js";

const countsEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const buildMarketingVoucherMigrationReport = (input: {
  migrationId: string;
  mode: MarketingVoucherMigrationMode;
  sourceProjectId: string;
  targetProjectId: string | null;
  piiRedacted: boolean;
  expectedCampaigns: number;
  expectedCodes: number;
  source: SourceScanResult;
  target: TargetScanResult | null;
  images: Map<string, MigrationImageResult>;
  uat: MigrationUatResult | null;
  startedAt: Date;
}): MarketingVoucherMigrationReport => {
  const issues = [...input.source.issues, ...(input.target?.issues ?? [])];
  if (input.source.campaigns.size !== input.expectedCampaigns) {
    issues.push(
      `SOURCE_CAMPAIGN_COUNT_MISMATCH:${input.source.campaigns.size}:${input.expectedCampaigns}`,
    );
  }
  if (input.source.total !== input.expectedCodes) {
    issues.push(
      `SOURCE_CODE_COUNT_MISMATCH:${input.source.total}:${input.expectedCodes}`,
    );
  }
  if (input.target) {
    if (input.target.campaignCount !== input.source.campaigns.size) {
      issues.push("TARGET_CAMPAIGN_COUNT_MISMATCH");
    }
    if (input.target.codeCount !== input.source.total) {
      issues.push("TARGET_CODE_COUNT_MISMATCH");
    }
    if (input.target.checksum !== input.source.checksum) {
      issues.push("TARGET_GLOBAL_CHECKSUM_MISMATCH");
    }
  }
  const campaigns = [...input.source.campaigns.values()].map((campaign) => {
    const campaignIssues: string[] = [];
    const targetCounts = input.target?.campaignCounts[campaign.id] ?? null;
    const targetChecksum = input.target?.campaignChecksums[campaign.id] ?? null;
    const targetCampaignHash =
      input.target?.campaignSourceHashes[campaign.id] ?? null;
    const image = input.images.get(campaign.id);
    if (campaign.declared_total !== campaign.counts.total) {
      campaignIssues.push(
        `DECLARED_TOTAL_DIFFERENCE:${campaign.declared_total}:${campaign.counts.total}`,
      );
    }
    if (targetCounts && !countsEqual(targetCounts, campaign.counts)) {
      campaignIssues.push("TARGET_STATUS_COUNTS_MISMATCH");
      issues.push(`TARGET_STATUS_COUNTS_MISMATCH:${campaign.id}`);
    }
    if (targetChecksum && targetChecksum !== campaign.checksum) {
      campaignIssues.push("TARGET_CAMPAIGN_CHECKSUM_MISMATCH");
      issues.push(`TARGET_CAMPAIGN_CHECKSUM_MISMATCH:${campaign.id}`);
    }
    if (targetCampaignHash && targetCampaignHash !== campaign.source_hash) {
      campaignIssues.push("TARGET_CAMPAIGN_SOURCE_HASH_MISMATCH");
      issues.push(`TARGET_CAMPAIGN_SOURCE_HASH_MISMATCH:${campaign.id}`);
    }
    if (image?.error) {
      campaignIssues.push(image.error);
      issues.push(`IMAGE_FAILED:${campaign.id}:${image.error}`);
    }
    return {
      campaign_id: campaign.id,
      source_declared_total: campaign.declared_total,
      source_actual_total: campaign.counts.total,
      target_actual_total: targetCounts?.total ?? null,
      source_counts: campaign.counts,
      target_counts: targetCounts,
      source_checksum: campaign.checksum,
      target_checksum: targetChecksum,
      purpose_defaulted:
        String(campaign.source.purpose ?? "").toLowerCase() !== "print" &&
        String(campaign.source.purpose ?? "").toLowerCase() !== "event",
      source_image_sha256: image?.source_sha256 ?? null,
      target_image_sha256: image?.target_sha256 ?? null,
      issues: campaignIssues,
    };
  });
  const imageResults = [...input.images.values()];
  if (input.uat && !input.uat.passed) issues.push(...input.uat.issues);
  return {
    version: 1,
    migration_id: input.migrationId,
    mode: input.mode,
    status: issues.length === 0 ? "COMPLETED" : "FAILED",
    source_project_id: input.sourceProjectId,
    target_project_id: input.targetProjectId,
    pii_redacted: input.piiRedacted,
    source_campaign_count: input.source.campaigns.size,
    target_campaign_count: input.target?.campaignCount ?? null,
    source_code_count: input.source.total,
    target_code_count: input.target?.codeCount ?? null,
    source_checksum: input.source.checksum,
    target_checksum: input.target?.checksum ?? null,
    duplicate_or_conflicting_code_count: (input.target?.issues ?? []).filter(
      (issue) => issue.includes("MISMATCH"),
    ).length,
    image_success_count: imageResults.filter(
      (image) => image.source_sha256 && !image.error,
    ).length,
    image_failure_count: imageResults.filter((image) => image.error).length,
    uat_campaign_ids: input.uat?.campaignIds ?? [],
    uat_passed: input.uat?.passed ?? null,
    uat_issues: input.uat?.issues ?? [],
    campaigns,
    issues: issues.slice(0, 1_000),
    started_at: input.startedAt,
    completed_at: new Date(),
  };
};
