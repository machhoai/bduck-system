import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MarketingVoucherMigrationReport } from "@bduck/shared-types";

import { applyMarketingVoucherMigration } from "./marketingVoucherMigrationApplyService.js";
import type { MigrationFirebaseClients } from "./marketingVoucherMigrationFirebase.js";
import { migrateLegacyCampaignImage } from "./marketingVoucherMigrationImageService.js";
import { transformLegacyCampaign } from "./marketingVoucherMigrationPolicy.js";
import { buildMarketingVoucherMigrationReport } from "./marketingVoucherMigrationReportService.js";
import {
  assertTargetBelongsToMigration,
  finalizeTargetMigration,
  markTargetMigrationFailed,
  readMigrationCheckpoint,
} from "./marketingVoucherMigrationRepository.js";
import {
  scanLegacyVoucherSource,
  scanMarketingVoucherTarget,
} from "./marketingVoucherMigrationScanService.js";
import type {
  MarketingVoucherMigrationOptions,
  MigrationImageResult,
  SourceCampaignScan,
} from "./marketingVoucherMigrationTypes.js";
import { runMarketingVoucherMigrationUat } from "./marketingVoucherMigrationUatService.js";

const ensureIdentities = (
  clients: MigrationFirebaseClients,
  options: MarketingVoucherMigrationOptions,
): void => {
  if (clients.source.projectId !== options.sourceProjectConfirmation) {
    throw new Error(
      `SOURCE_PROJECT_CONFIRMATION_MISMATCH:${clients.source.projectId}`,
    );
  }
  if (
    clients.target &&
    clients.target.projectId !== options.targetProjectConfirmation
  ) {
    throw new Error(
      `TARGET_PROJECT_CONFIRMATION_MISMATCH:${clients.target.projectId}`,
    );
  }
  if (
    clients.target &&
    clients.target.projectId !== "jw-system-f2104" &&
    (options.mode === "APPLY" || options.mode === "RESUME") &&
    !options.redactPii
  ) {
    throw new Error("NON_PRODUCTION_TARGET_REQUIRES_REDACT_PII");
  }
};

const verifySourceBaseline = async (
  clients: MigrationFirebaseClients,
  options: MarketingVoucherMigrationOptions,
): Promise<void> => {
  const [campaigns, codes] = await Promise.all([
    clients.source.db.collection("voucher_campaigns").count().get(),
    clients.source.db.collection("voucher_codes").count().get(),
  ]);
  if (campaigns.data().count !== options.expectedCampaigns) {
    throw new Error(
      `SOURCE_CAMPAIGN_BASELINE_MISMATCH:${campaigns.data().count}:${options.expectedCampaigns}`,
    );
  }
  if (codes.data().count !== options.expectedCodes) {
    throw new Error(
      `SOURCE_CODE_BASELINE_MISMATCH:${codes.data().count}:${options.expectedCodes}`,
    );
  }
};

const collectImages = async (input: {
  campaigns: Iterable<SourceCampaignScan>;
  clients: MigrationFirebaseClients;
  migrationId: string;
  writeTarget: boolean;
}): Promise<Map<string, MigrationImageResult>> => {
  const images = new Map<string, MigrationImageResult>();
  for (const campaign of input.campaigns) {
    images.set(
      campaign.id,
      await migrateLegacyCampaignImage({
        campaignId: campaign.id,
        sourceUrl: campaign.image_url,
        targetStorage: input.clients.target?.storage ?? null,
        targetBucketName: input.clients.target?.bucketName ?? null,
        migrationId: input.migrationId,
        writeTarget: input.writeTarget,
      }),
    );
  }
  return images;
};

const writeLocalReport = async (
  options: MarketingVoucherMigrationOptions,
  report: MarketingVoucherMigrationReport,
): Promise<string> => {
  await mkdir(options.reportDirectory, { recursive: true });
  const path = join(
    options.reportDirectory,
    `${options.migrationId}-${options.mode.toLowerCase()}.json`,
  );
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
};

export const runMarketingVoucherMigration = async (
  clients: MigrationFirebaseClients,
  options: MarketingVoucherMigrationOptions,
): Promise<{ report: MarketingVoucherMigrationReport; reportPath: string }> => {
  ensureIdentities(clients, options);
  await verifySourceBaseline(clients, options);
  const startedAt = new Date();
  const writes = options.mode === "APPLY" || options.mode === "RESUME";
  try {
    const applied = writes
      ? await applyMarketingVoucherMigration(clients, options, startedAt)
      : {
          source: await scanLegacyVoucherSource({
            source: clients.source.db,
            batchSize: options.batchSize,
          }),
          images: null,
        };
    const source = applied.source;
    const images =
      applied.images ??
      (await collectImages({
        campaigns: source.campaigns.values(),
        clients,
        migrationId: options.migrationId,
        writeTarget: false,
      }));
    let targetScan = null;
    let uat = null;
    let checkpoint = null;
    if (clients.target) {
      checkpoint = await readMigrationCheckpoint(
        clients.target.db,
        options.migrationId,
      );
      if (!checkpoint) throw new Error("TARGET_MIGRATION_CHECKPOINT_NOT_FOUND");
      await assertTargetBelongsToMigration(
        clients.target.db,
        options.migrationId,
      );
      targetScan = await scanMarketingVoucherTarget({
        target: clients.target.db,
        batchSize: options.batchSize,
        migrationId: options.migrationId,
      });
      uat = await runMarketingVoucherMigrationUat({
        target: clients.target.db,
        campaigns: [...source.campaigns.values()],
        piiRedacted: checkpoint.pii_redacted,
      });
    }
    const report = buildMarketingVoucherMigrationReport({
      migrationId: options.migrationId,
      mode: options.mode,
      sourceProjectId: clients.source.projectId,
      targetProjectId: clients.target?.projectId ?? null,
      piiRedacted: checkpoint?.pii_redacted ?? options.redactPii,
      expectedCampaigns: options.expectedCampaigns,
      expectedCodes: options.expectedCodes,
      source,
      target: targetScan,
      images,
      uat,
      startedAt,
    });
    if (writes && clients.target && checkpoint) {
      const finalCampaigns = [...source.campaigns.values()].map((campaign) =>
        transformLegacyCampaign({
          id: campaign.id,
          source: campaign.source,
          migrationId: options.migrationId,
          sourceProjectId: clients.source.projectId,
          actorId: options.actorId,
          syncTime: new Date(),
          counts: campaign.counts,
          image: images.get(campaign.id),
          redactPii: checkpoint.pii_redacted,
        }),
      );
      await finalizeTargetMigration({
        target: clients.target.db,
        campaigns: finalCampaigns,
        checkpoint,
        report,
      });
    }
    const reportPath = await writeLocalReport(options, report);
    return { report, reportPath };
  } catch (error) {
    if (writes && clients.target) {
      await markTargetMigrationFailed(
        clients.target.db,
        options.migrationId,
        error instanceof Error ? error.message : String(error),
      ).catch(() => undefined);
    }
    throw error;
  }
};
