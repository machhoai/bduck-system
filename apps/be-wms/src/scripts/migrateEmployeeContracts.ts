import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { importLegacyEmployeeContractRecord } from "../repositories/employeeContractMigrationRepository.js";
import { findEmployeeContractRolloutState } from "../repositories/employeeContractRolloutRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import { planEmployeeContractLegacyMigration } from "../services/employeeContractLegacyMigrationPlanner.js";
import { parseEmployeeContractImportWorkbook } from "../services/employeeContractImportWorkbookService.js";
import {
  assertConfirmedApply,
  readScriptArgument,
} from "./employeeContractScriptGuard.js";

const main = async () => {
  const guard = assertConfirmedApply();
  const source = readScriptArgument("source");
  if (!source) throw new Error("SOURCE_XLSX_REQUIRED");
  const sourcePath = resolve(source);
  const file = await readFile(sourcePath);
  const checksum = createHash("sha256").update(file).digest("hex");
  const [rows, profiles, rollout] = await Promise.all([
    parseEmployeeContractImportWorkbook(file),
    findEmployeeProfiles(),
    findEmployeeContractRolloutState(),
  ]);
  const now = new Date();
  const plan = planEmployeeContractLegacyMigration({
    rows,
    profiles,
    existing_contracts: rollout.contracts,
    actor_id: guard.initiatedBy,
    now,
  });
  const invalid = plan.filter((row) => row.messages.length > 0);
  console.log(
    JSON.stringify(
      {
        mode: guard.apply ? "APPLY" : "DRY_RUN",
        project_id: guard.projectId,
        source_file: sourcePath,
        source_checksum: checksum,
        total_rows: plan.length,
        valid_rows: plan.length - invalid.length,
        invalid_rows: invalid.length,
        rows: plan.map((row) => ({
          row_number: row.row_number,
          employee_code: row.employee_code,
          employee_profile_id: row.profile?.id ?? null,
          contract_number: row.candidate?.contract_number ?? null,
          messages: row.messages,
        })),
      },
      null,
      2,
    ),
  );
  if (!guard.apply) {
    if (invalid.length > 0) process.exitCode = 2;
    return;
  }
  if (invalid.length > 0) throw new Error("IMPORT_HAS_INVALID_ROWS");

  let imported = 0;
  let replayed = 0;
  for (const row of plan) {
    if (!row.profile || !row.candidate) continue;
    const sourceRow = rows.find((item) => item.row_number === row.row_number)!;
    const result = await importLegacyEmployeeContractRecord({
      source_checksum: checksum,
      row_number: row.row_number,
      payload: sourceRow.normalized_payload,
      profile: row.profile,
      context: {
        actor_id: guard.initiatedBy,
        action_time: now,
        idempotency_key: `${checksum}:${row.row_number}`,
      },
    });
    if (result.replayed) replayed += 1;
    else imported += 1;
  }
  console.log(
    JSON.stringify({ mode: "APPLY_RESULT", imported, replayed }, null, 2),
  );
};

main().catch((error) => {
  console.error(
    "[migrateEmployeeContracts]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
