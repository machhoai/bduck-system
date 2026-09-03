import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import type { MarketingVoucherMigrationOptions } from "./marketingVoucherMigrationTypes.js";

const readArgument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};

const loadLegacyEnvironment = (): void => {
  const file =
    readArgument("source-env-file") ??
    process.env.MARKETING_VOUCHER_SOURCE_ENV_FILE;
  if (!file) return;
  if (!existsSync(file)) throw new Error(`SOURCE_ENV_FILE_NOT_FOUND:${file}`);
  loadEnvFile(file);
};

const optionSchema = z.object({
  migrationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/u),
  actorId: z.string().trim().min(3).max(160),
  batchSize: z.number().int().min(10).max(2_000),
  sourceProjectConfirmation: z.string().trim().min(1),
  targetProjectConfirmation: z.string().trim().min(1).nullable(),
  expectedCampaigns: z.number().int().positive(),
  expectedCodes: z.number().int().positive(),
  reportDirectory: z.string().trim().min(1),
});

export const readMarketingVoucherMigrationOptions =
  (): MarketingVoucherMigrationOptions => {
    loadLegacyEnvironment();
    const flags = ["dry-run", "apply", "resume", "verify", "reconcile"].filter(
      (flag) => process.argv.includes(`--${flag}`),
    );
    if (flags.length !== 1) {
      throw new Error("EXACTLY_ONE_MIGRATION_MODE_REQUIRED");
    }
    const mode = flags[0]!
      .replace("-", "_")
      .toUpperCase() as MarketingVoucherMigrationOptions["mode"];
    const writesTarget = mode === "APPLY" || mode === "RESUME";
    const reportDirectory =
      readArgument("report-directory") ??
      fileURLToPath(
        new URL(
          "../../../../artifacts/marketing-voucher-migration",
          import.meta.url,
        ),
      );
    const parsed = optionSchema.parse({
      migrationId:
        readArgument("migration-id") ?? "voucher-marketing-v1-rehearsal",
      actorId:
        readArgument("actor-id") ?? (writesTarget ? "" : "migration-dry-run"),
      batchSize: Number(readArgument("batch-size") ?? 400),
      sourceProjectConfirmation: readArgument("confirm-source-project") ?? "",
      targetProjectConfirmation: readArgument("confirm-target-project") ?? null,
      expectedCampaigns: Number(readArgument("expected-campaigns") ?? 14),
      expectedCodes: Number(readArgument("expected-codes") ?? 1_428_254),
      reportDirectory,
    });
  if (mode !== "DRY_RUN" && !parsed.targetProjectConfirmation) {
    throw new Error("TARGET_PROJECT_CONFIRMATION_REQUIRED");
  }
    return {
      ...parsed,
      mode,
      redactPii: process.argv.includes("--redact-pii"),
    };
  };
