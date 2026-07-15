import type {
  BackfillIssue,
  RuntimeContext,
} from "./facilityAccessBackfillTypes.js";
import { recordIssue } from "./facilityAccessBackfillTypes.js";
import { checkpointMigration } from "./facilityAccessBackfillRuntime.js";

export const recordIssues = (
  context: RuntimeContext,
  issues: BackfillIssue[],
): void => issues.forEach((issue) => recordIssue(context.report, issue));

export const checkpointReport = async (
  context: RuntimeContext,
  patch: Record<string, unknown>,
): Promise<void> =>
  checkpointMigration(context, {
    ...patch,
    processed_facility_count: context.report.processedFacilities,
    processed_user_count: context.report.processedUsers,
    processed_assignment_count: context.report.processedAssignments,
    scanned_profile_count: context.report.scannedProfiles,
    planned_write_count:
      context.report.plannedEntityWrites + context.report.plannedAuditWrites,
    written_count:
      context.report.writtenEntityCount + context.report.writtenAuditCount,
    conflict_count: context.report.issueCounts.WORKPLACE_CONFLICT ?? 0,
    skipped_user_count:
      (context.report.issueCounts.DELETED_USER_SKIPPED ?? 0) +
      (context.report.issueCounts.ORPHAN_USER_NO_PROFILE ?? 0) +
      (context.report.issueCounts.DUPLICATE_ACTIVE_PROFILES ?? 0) +
      (context.report.issueCounts.ONLY_DELETED_PROFILES ?? 0) +
      (context.report.issueCounts.NO_ACTIVE_PROFILE ?? 0) +
      (context.report.issueCounts.PROFILE_MISSING_WORKPLACE ?? 0) +
      (context.report.issueCounts.WORKPLACE_FACILITY_NOT_FOUND ?? 0) +
      (context.report.issueCounts.WORKPLACE_FACILITY_DELETED ?? 0) +
      (context.report.issueCounts.WORKPLACE_FACILITY_INACTIVE ?? 0) +
      (context.report.issueCounts.WORKPLACE_CONFLICT ?? 0),
    failed_user_count:
      (context.report.issueCounts.ORPHAN_USER_NO_PROFILE ?? 0) +
      (context.report.issueCounts.DUPLICATE_ACTIVE_PROFILES ?? 0) +
      (context.report.issueCounts.NO_ACTIVE_PROFILE ?? 0) +
      (context.report.issueCounts.PROFILE_MISSING_WORKPLACE ?? 0) +
      (context.report.issueCounts.WORKPLACE_FACILITY_NOT_FOUND ?? 0) +
      (context.report.issueCounts.WORKPLACE_FACILITY_DELETED ?? 0) +
      (context.report.issueCounts.WORKPLACE_FACILITY_INACTIVE ?? 0) +
      (context.report.issueCounts.WORKPLACE_CONFLICT ?? 0),
    issue_counts: context.report.issueCounts,
  });

export const registerPlannedWrite = (context: RuntimeContext): void => {
  context.report.plannedEntityWrites += 1;
  context.report.plannedAuditWrites += 1;
};

export const registerCommittedWrite = (
  context: RuntimeContext,
  committed: boolean,
): void => {
  if (!committed) return;
  context.report.writtenEntityCount += 1;
  context.report.writtenAuditCount += 1;
};
