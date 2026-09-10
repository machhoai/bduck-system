import type {
  MarketingVoucherCodeCounts,
  MarketingVoucherCodeStatus,
} from "@bduck/shared-types";
import type { Firestore } from "firebase-admin/firestore";

import {
  appendMigrationChecksum,
  canonicalHash,
  createEmptyMigrationCounts,
  incrementMigrationCount,
  mapLegacyCodeStatus,
  migrationSha256,
} from "./marketingVoucherMigrationPolicy.js";
import {
  readLegacyCampaigns,
  readLegacyCodePage,
  readTargetCampaigns,
  readTargetCodePage,
  type LegacyDocument,
} from "./marketingVoucherMigrationRepository.js";
import type {
  LegacyVoucherCode,
  SourceCampaignScan,
} from "./marketingVoucherMigrationTypes.js";

const CHECKSUM_SEED = migrationSha256("marketing-vouchers-migration:v1");

export interface SourceScanProgress {
  cursor: string;
  total: number;
  checksum: string;
  campaignCounts: Record<string, MarketingVoucherCodeCounts>;
  campaignChecksums: Record<string, string>;
  documents: Array<LegacyDocument<LegacyVoucherCode>>;
}

export interface SourceScanResult {
  campaigns: Map<string, SourceCampaignScan>;
  total: number;
  checksum: string;
  issues: string[];
  lastCursor: string | null;
}

const cloneCounts = (
  counts: Record<string, MarketingVoucherCodeCounts>,
): Record<string, MarketingVoucherCodeCounts> =>
  Object.fromEntries(
    Object.entries(counts).map(([id, value]) => [id, { ...value }]),
  );

export const scanLegacyVoucherSource = async (input: {
  source: Firestore;
  batchSize: number;
  startCursor?: string | null;
  initialTotal?: number;
  initialChecksum?: string;
  initialCampaignCounts?: Record<string, MarketingVoucherCodeCounts>;
  initialCampaignChecksums?: Record<string, string>;
  onPage?: (progress: SourceScanProgress) => Promise<void>;
}): Promise<SourceScanResult> => {
  const legacyCampaigns = await readLegacyCampaigns(input.source);
  const counts = input.initialCampaignCounts
    ? cloneCounts(input.initialCampaignCounts)
    : Object.fromEntries(
        legacyCampaigns.map((campaign) => [
          campaign.id,
          createEmptyMigrationCounts(),
        ]),
      );
  const campaignChecksums = input.initialCampaignChecksums
    ? { ...input.initialCampaignChecksums }
    : Object.fromEntries(
        legacyCampaigns.map((campaign) => [campaign.id, CHECKSUM_SEED]),
      );
  let checksum = input.initialChecksum ?? CHECKSUM_SEED;
  let total = input.initialTotal ?? 0;
  let cursor = input.startCursor ?? null;
  const issues: string[] = [];
  let sourceExhausted = false;
  while (!sourceExhausted) {
    const documents = await readLegacyCodePage(
      input.source,
      cursor,
      input.batchSize,
    );
    if (documents.length === 0) {
      sourceExhausted = true;
      continue;
    }
    for (const document of documents) {
      const campaignId = String(document.data.campaignId ?? "");
      const campaignCount = counts[campaignId];
      if (!campaignCount) {
        issues.push(`ORPHAN_CODE:${document.id}:${campaignId}`);
        continue;
      }
      const status = mapLegacyCodeStatus(document.data.status);
      if (status.issue) issues.push(`${status.issue}:${document.id}`);
      incrementMigrationCount(campaignCount, status.status);
      const sourceHash = canonicalHash({ ...document.data, id: document.id });
      checksum = appendMigrationChecksum(checksum, document.id, sourceHash);
      campaignChecksums[campaignId] = appendMigrationChecksum(
        campaignChecksums[campaignId] ?? CHECKSUM_SEED,
        document.id,
        sourceHash,
      );
      total += 1;
    }
    cursor = documents.at(-1)!.id;
    await input.onPage?.({
      cursor,
      total,
      checksum,
      campaignCounts: cloneCounts(counts),
      campaignChecksums: { ...campaignChecksums },
      documents,
    });
    if (total % 100_000 < documents.length) {
      console.info(
        `[voucher-migration] scanned ${total.toLocaleString("en-US")} codes`,
      );
    }
  }
  const campaigns = new Map<string, SourceCampaignScan>(
    legacyCampaigns.map((campaign) => [
      campaign.id,
      {
        id: campaign.id,
        source: campaign.data,
        source_hash: canonicalHash({ ...campaign.data, id: campaign.id }),
        declared_total: Number(campaign.data.totalIssued ?? 0),
        counts: counts[campaign.id] ?? createEmptyMigrationCounts(),
        checksum: campaignChecksums[campaign.id] ?? CHECKSUM_SEED,
        image_url:
          typeof campaign.data.image === "string" && campaign.data.image
            ? campaign.data.image
            : null,
      },
    ]),
  );
  return { campaigns, total, checksum, issues, lastCursor: cursor };
};

export interface TargetScanResult {
  campaignCount: number;
  codeCount: number;
  checksum: string;
  campaignCounts: Record<string, MarketingVoucherCodeCounts>;
  campaignChecksums: Record<string, string>;
  campaignSourceHashes: Record<string, string>;
  issues: string[];
}

export const scanMarketingVoucherTarget = async (input: {
  target: Firestore;
  batchSize: number;
  migrationId: string;
}): Promise<TargetScanResult> => {
  const campaignDocuments = await readTargetCampaigns(input.target);
  const campaignCounts = Object.fromEntries(
    campaignDocuments.map((document) => [
      document.id,
      createEmptyMigrationCounts(),
    ]),
  );
  const campaignChecksums = Object.fromEntries(
    campaignDocuments.map((document) => [document.id, CHECKSUM_SEED]),
  );
  const campaignSourceHashes = Object.fromEntries(
    campaignDocuments.map((document) => [
      document.id,
      String(document.get("legacy_metadata.source_hash") ?? ""),
    ]),
  );
  const issues: string[] = [];
  let checksum = CHECKSUM_SEED;
  let cursor: string | null = null;
  let codeCount = 0;
  let targetExhausted = false;
  while (!targetExhausted) {
    const documents = await readTargetCodePage(
      input.target,
      cursor,
      input.batchSize,
    );
    if (documents.length === 0) {
      targetExhausted = true;
      continue;
    }
    for (const document of documents) {
      const campaignId = String(document.get("campaign_id") ?? "");
      const counts = campaignCounts[campaignId];
      const status = String(
        document.get("status"),
      ) as MarketingVoucherCodeStatus;
      const sourceHash = String(document.get("source_hash") ?? "");
      if (!counts)
        issues.push(`TARGET_ORPHAN_CODE:${document.id}:${campaignId}`);
      else incrementMigrationCount(counts, status);
      if (!sourceHash) issues.push(`TARGET_SOURCE_HASH_MISSING:${document.id}`);
      if (document.get("legacy_metadata.migration_id") !== input.migrationId) {
        issues.push(`TARGET_MIGRATION_ID_MISMATCH:${document.id}`);
      }
      checksum = appendMigrationChecksum(checksum, document.id, sourceHash);
      campaignChecksums[campaignId] = appendMigrationChecksum(
        campaignChecksums[campaignId] ?? CHECKSUM_SEED,
        document.id,
        sourceHash,
      );
      codeCount += 1;
    }
    cursor = documents.at(-1)!.id;
    if (codeCount % 100_000 < documents.length) {
      console.info(
        `[voucher-migration] reconciled ${codeCount.toLocaleString("en-US")} target codes`,
      );
    }
  }
  return {
    campaignCount: campaignDocuments.length,
    codeCount,
    checksum,
    campaignCounts,
    campaignChecksums,
    campaignSourceHashes,
    issues,
  };
};
