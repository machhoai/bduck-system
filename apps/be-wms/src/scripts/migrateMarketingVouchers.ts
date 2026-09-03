import { readMarketingVoucherMigrationOptions } from "./marketingVoucherMigrationConfig.js";
import { createMarketingVoucherMigrationClients } from "./marketingVoucherMigrationFirebase.js";
import { runMarketingVoucherMigration } from "./marketingVoucherMigrationService.js";

const main = async (): Promise<void> => {
  const options = readMarketingVoucherMigrationOptions();
  const clients = createMarketingVoucherMigrationClients(
    options.mode !== "DRY_RUN",
    options.targetProjectConfirmation,
  );
  try {
    const result = await runMarketingVoucherMigration(clients, options);
    console.info(
      JSON.stringify(
        {
          migration_id: result.report.migration_id,
          mode: result.report.mode,
          status: result.report.status,
          source_project_id: result.report.source_project_id,
          target_project_id: result.report.target_project_id,
          source_campaign_count: result.report.source_campaign_count,
          target_campaign_count: result.report.target_campaign_count,
          source_code_count: result.report.source_code_count,
          target_code_count: result.report.target_code_count,
          image_success_count: result.report.image_success_count,
          image_failure_count: result.report.image_failure_count,
          uat_passed: result.report.uat_passed,
          issue_count: result.report.issues.length,
          report_path: result.reportPath,
        },
        null,
        2,
      ),
    );
    if (result.report.status !== "COMPLETED") process.exitCode = 2;
  } finally {
    await clients.close();
  }
};

main().catch((error) => {
  console.error(
    "[migrateMarketingVouchers]",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
