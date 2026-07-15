import {
  runAssignmentPass,
  runProfileDiagnosticsPass,
} from "./facilityAccessBackfillAssignmentProfilePasses.js";
import {
  runOfficeConfigPass,
  runUserPass,
} from "./facilityAccessBackfillFacilityUserPasses.js";
import {
  acquireMigrationLease,
  createRuntimeContext,
  failMigration,
  isCompletedState,
  parseBackfillOptions,
  releaseCompletedMigration,
  resolveProjectId,
} from "./facilityAccessBackfillRuntime.js";
import type { BackfillStage } from "./facilityAccessBackfillTypes.js";

const stageOrder: BackfillStage[] = [
  "OFFICE_CONFIGS",
  "USERS",
  "ASSIGNMENTS",
  "PROFILE_DIAGNOSTICS",
  "COMPLETED",
];

const shouldRun = (current: BackfillStage, target: BackfillStage): boolean =>
  stageOrder.indexOf(current) <= stageOrder.indexOf(target);

const run = async (): Promise<void> => {
  const options = parseBackfillOptions();
  const projectId = resolveProjectId(options);
  const context = createRuntimeContext(options, projectId);
  let leaseAcquired = false;

  try {
    const state = await acquireMigrationLease(context);
    leaseAcquired = options.apply && !isCompletedState(state);
    if (isCompletedState(state)) {
      console.log(
        JSON.stringify(
          {
            ...context.report,
            status: "ALREADY_COMPLETED",
            note: "No domain data was changed.",
          },
          null,
          2,
        ),
      );
      return;
    }

    if (state && options.resume) {
      context.report.processedFacilities = state.processed_facility_count;
      context.report.processedUsers = state.processed_user_count;
      context.report.processedAssignments = state.processed_assignment_count;
      context.report.scannedProfiles = state.scanned_profile_count;
      context.report.plannedEntityWrites = Math.floor(
        state.planned_write_count / 2,
      );
      context.report.plannedAuditWrites =
        state.planned_write_count - context.report.plannedEntityWrites;
      context.report.writtenEntityCount = Math.floor(state.written_count / 2);
      context.report.writtenAuditCount =
        state.written_count - context.report.writtenEntityCount;
      context.report.issueCounts = { ...state.issue_counts };
    }

    const currentStage = state?.stage ?? "OFFICE_CONFIGS";
    if (shouldRun(currentStage, "OFFICE_CONFIGS")) {
      await runOfficeConfigPass(context, state);
    }
    if (shouldRun(currentStage, "USERS")) {
      await runUserPass(context, state);
    }
    if (shouldRun(currentStage, "ASSIGNMENTS")) {
      await runAssignmentPass(context, state);
    }
    if (shouldRun(currentStage, "PROFILE_DIAGNOSTICS")) {
      await runProfileDiagnosticsPass(context, state);
    }

    await releaseCompletedMigration(context);
    console.log(
      JSON.stringify(
        {
          ...context.report,
          status: options.apply ? "COMPLETED" : "DRY_RUN_COMPLETE",
          ...(options.apply ? {} : { dryRunWroteData: false }),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (leaseAcquired) {
      try {
        await failMigration(context, error);
      } catch (checkpointError) {
        console.error("[facility-access-backfill] Failed to checkpoint error", {
          checkpointError,
        });
      }
    }
    throw error;
  }
};

run().catch((error) => {
  console.error("[facility-access-backfill] Migration failed", error);
  process.exitCode = 1;
});
