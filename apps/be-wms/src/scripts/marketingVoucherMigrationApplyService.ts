import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";

import type { MigrationFirebaseClients } from "./marketingVoucherMigrationFirebase.js";
import { migrateLegacyCampaignImage } from "./marketingVoucherMigrationImageService.js";
import {
  transformLegacyCampaign,
  transformLegacyCode,
} from "./marketingVoucherMigrationPolicy.js";
import {
  assertTargetBelongsToMigration,
  initializeTargetMigration,
  readLegacyCampaigns,
  readLegacyStaffNames,
  readMigrationCheckpoint,
  readTargetCounts,
  stageTargetCampaignFinalData,
  writeTargetCodeGroup,
} from "./marketingVoucherMigrationRepository.js";
import {
  scanLegacyVoucherSource,
  type SourceScanProgress,
  type SourceScanResult,
} from "./marketingVoucherMigrationScanService.js";
import type {
  MarketingVoucherMigrationOptions,
  MigrationCheckpoint,
  MigrationImageResult,
  SourceCampaignScan,
} from "./marketingVoucherMigrationTypes.js";

const buildCampaignShells = async (input: {
  clients: MigrationFirebaseClients;
  options: MarketingVoucherMigrationOptions;
  syncTime: Date;
}): Promise<{
  source: Map<string, SourceCampaignScan>;
  campaigns: MarketingVoucherCampaign[];
}> => {
  const documents = await readLegacyCampaigns(input.clients.source.db);
  const source = new Map<string, SourceCampaignScan>(
    documents.map((document) => [
      document.id,
      {
        id: document.id,
        source: document.data,
        source_hash: "",
        declared_total: Number(document.data.totalIssued ?? 0),
        counts: { available: 0, distributed: 0, used: 0, revoked: 0, total: 0 },
        checksum: "",
        image_url:
          typeof document.data.image === "string" && document.data.image
            ? document.data.image
            : null,
      },
    ]),
  );
  const campaigns = documents.map((document) =>
    transformLegacyCampaign({
      id: document.id,
      source: document.data,
      migrationId: input.options.migrationId,
      sourceProjectId: input.clients.source.projectId,
      actorId: input.options.actorId,
      syncTime: input.syncTime,
      redactPii: input.options.redactPii,
    }),
  );
  campaigns.forEach((campaign) => {
    source.get(campaign.id)!.source_hash =
      campaign.legacy_metadata?.source_hash ?? "";
  });
  return { source, campaigns };
};

const createInitialCheckpoint = (input: {
  options: MarketingVoucherMigrationOptions;
  sourceProjectId: string;
  targetProjectId: string;
  campaignIds: string[];
  now: Date;
}): MigrationCheckpoint => ({
  id: input.options.migrationId,
  source_project_id: input.sourceProjectId,
  target_project_id: input.targetProjectId,
  status: "RUNNING",
  stage: "CODES",
  code_cursor: null,
  processed_code_count: 0,
  source_checksum: "",
  campaign_counts: Object.fromEntries(
    input.campaignIds.map((id) => [
      id,
      { available: 0, distributed: 0, used: 0, revoked: 0, total: 0 },
    ]),
  ),
  campaign_checksums: Object.fromEntries(
    input.campaignIds.map((id) => [id, ""]),
  ),
  pii_redacted: input.options.redactPii,
  actor_id: input.options.actorId,
  is_deleted: false,
  action_time: input.now,
  sync_time: input.now,
  created_at: input.now,
  updated_at: input.now,
});

const migrateImages = async (input: {
  clients: MigrationFirebaseClients;
  campaigns: Iterable<SourceCampaignScan>;
  migrationId: string;
}): Promise<Map<string, MigrationImageResult>> => {
  const images = new Map<string, MigrationImageResult>();
  for (const campaign of input.campaigns) {
    images.set(
      campaign.id,
      await migrateLegacyCampaignImage({
        campaignId: campaign.id,
        sourceUrl: campaign.image_url,
        targetStorage: input.clients.target!.storage,
        targetBucketName: input.clients.target!.bucketName,
        migrationId: input.migrationId,
        writeTarget: true,
      }),
    );
  }
  return images;
};

const prepareCheckpoint = async (input: {
  clients: MigrationFirebaseClients;
  options: MarketingVoucherMigrationOptions;
  shells: Awaited<ReturnType<typeof buildCampaignShells>>;
  startedAt: Date;
}): Promise<MigrationCheckpoint> => {
  const target = input.clients.target!;
  const existing = await readMigrationCheckpoint(
    target.db,
    input.options.migrationId,
  );
  if (input.options.mode === "APPLY") {
    const counts = await readTargetCounts(target.db);
    if (counts.campaigns !== 0 || counts.codes !== 0 || existing) {
      throw new Error("APPLY_REQUIRES_EMPTY_TARGET_AND_NEW_MIGRATION_ID");
    }
    const checkpoint = createInitialCheckpoint({
      options: input.options,
      sourceProjectId: input.clients.source.projectId,
      targetProjectId: target.projectId,
      campaignIds: [...input.shells.source.keys()],
      now: input.startedAt,
    });
    await initializeTargetMigration(target.db, input.shells.campaigns, checkpoint);
    return checkpoint;
  }
  if (!existing) throw new Error("RESUME_CHECKPOINT_NOT_FOUND");
  if (
    existing.source_project_id !== input.clients.source.projectId ||
    existing.target_project_id !== target.projectId ||
    existing.pii_redacted !== input.options.redactPii
  ) {
    throw new Error("RESUME_CHECKPOINT_CONFIGURATION_MISMATCH");
  }
  await assertTargetBelongsToMigration(target.db, input.options.migrationId);
  return existing;
};

export const applyMarketingVoucherMigration = async (
  clients: MigrationFirebaseClients,
  options: MarketingVoucherMigrationOptions,
  startedAt: Date,
): Promise<{
  source: SourceScanResult;
  images: Map<string, MigrationImageResult>;
}> => {
  const target = clients.target!;
  const shells = await buildCampaignShells({ clients, options, syncTime: startedAt });
  let checkpoint = await prepareCheckpoint({ clients, options, shells, startedAt });
  const images = await migrateImages({
    clients,
    campaigns: shells.source.values(),
    migrationId: options.migrationId,
  });
  let written = 0;
  const startingCheckpoint = checkpoint;
  let pendingCodes: MarketingVoucherCode[] = [];
  let pendingProgress: SourceScanProgress | null = null;
  const flushPendingCodes = async (): Promise<void> => {
    if (!pendingProgress || pendingCodes.length === 0) return;
    const now = new Date();
    checkpoint = {
      ...startingCheckpoint,
      code_cursor: pendingProgress.cursor,
      processed_code_count: pendingProgress.total,
      source_checksum: pendingProgress.checksum,
      campaign_counts: pendingProgress.campaignCounts,
      campaign_checksums: pendingProgress.campaignChecksums,
      updated_at: now,
      sync_time: now,
    };
    written += await writeTargetCodeGroup({
      target: target.db,
      migrationId: options.migrationId,
      actorId: options.actorId,
      actionTime: startingCheckpoint.action_time,
      codes: pendingCodes,
      checkpoint,
      disableThrottling: target.projectId !== "jw-system-f2104",
    });
    pendingCodes = [];
    pendingProgress = null;
  };
  const source = await scanLegacyVoucherSource({
    source: clients.source.db,
    batchSize: options.batchSize,
    startCursor: startingCheckpoint.code_cursor,
    initialTotal: startingCheckpoint.processed_code_count,
    initialChecksum: startingCheckpoint.source_checksum || undefined,
    initialCampaignCounts: startingCheckpoint.campaign_counts,
    initialCampaignChecksums: Object.values(
      startingCheckpoint.campaign_checksums,
    ).some(Boolean)
      ? startingCheckpoint.campaign_checksums
      : undefined,
    onPage: async (progress) => {
      const staffIds = progress.documents
        .map((document) => String(document.data.usedByStaffId ?? ""))
        .filter(Boolean);
      const staffNames = await readLegacyStaffNames(clients.source.db, staffIds);
      const codes = progress.documents.map((document) => {
        const campaignId = String(document.data.campaignId ?? "");
        if (!shells.source.has(campaignId)) {
          throw new Error(`ORPHAN_SOURCE_CODE:${document.id}:${campaignId}`);
        }
        return transformLegacyCode({
          id: document.id,
          source: document.data,
          migrationId: options.migrationId,
          sourceProjectId: clients.source.projectId,
          actorId: options.actorId,
          syncTime: new Date(),
          staffName:
            staffNames.get(String(document.data.usedByStaffId ?? "")) ?? null,
          redactPii: options.redactPii,
        }).code;
      });
      pendingCodes.push(...codes);
      pendingProgress = progress;
      if (pendingCodes.length >= 10_000) await flushPendingCodes();
    },
  });
  await flushPendingCodes();
  console.info(`[voucher-migration] wrote ${written.toLocaleString("en-US")} new codes`);
  const campaigns = [...source.campaigns.values()].map((campaign) =>
    transformLegacyCampaign({
      id: campaign.id,
      source: campaign.source,
      migrationId: options.migrationId,
      sourceProjectId: clients.source.projectId,
      actorId: options.actorId,
      syncTime: new Date(),
      counts: campaign.counts,
      image: images.get(campaign.id),
      redactPii: options.redactPii,
    }),
  );
  await stageTargetCampaignFinalData({
    target: target.db,
    campaigns,
    checkpoint,
  });
  return { source, images };
};
