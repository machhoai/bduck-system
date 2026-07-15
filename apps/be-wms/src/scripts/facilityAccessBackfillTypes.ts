import type { FacilityAccessMigrationState } from "@bduck/shared-types";

export const BACKFILL_STAGES = [
  "OFFICE_CONFIGS",
  "USERS",
  "ASSIGNMENTS",
  "PROFILE_DIAGNOSTICS",
  "COMPLETED",
] as const;

export type BackfillStage = (typeof BACKFILL_STAGES)[number];

export const BACKFILL_ISSUE_CODES = [
  "DELETED_OFFICE_SKIPPED",
  "DELETED_OFFICE_CONFIG_CONFLICT",
  "DELETED_USER_SKIPPED",
  "ORPHAN_USER_NO_PROFILE",
  "DUPLICATE_ACTIVE_PROFILES",
  "ONLY_DELETED_PROFILES",
  "NO_ACTIVE_PROFILE",
  "PROFILE_MISSING_WORKPLACE",
  "WORKPLACE_FACILITY_NOT_FOUND",
  "WORKPLACE_FACILITY_DELETED",
  "WORKPLACE_FACILITY_INACTIVE",
  "WORKPLACE_CONFLICT",
  "LEGACY_GLOBAL_ASSIGNMENT_PRESERVED",
  "ORPHAN_ASSIGNMENT_USER_NOT_FOUND",
  "INVALID_ASSIGNMENT_SCOPE_ORIGIN",
  "ORPHAN_PROFILE_NO_USER_ID",
  "ORPHAN_PROFILE_USER_NOT_FOUND",
  "ORPHAN_PROFILE_USER_DELETED",
] as const;

export type BackfillIssueCode = (typeof BACKFILL_ISSUE_CODES)[number];

export interface BackfillIssue {
  code: BackfillIssueCode;
  entity_type: string;
  entity_id: string;
  detail: string;
}

export interface BackfillOptions {
  apply: boolean;
  resume: boolean;
  batchSize: number;
  migrationId: string;
  confirmProject?: string;
  initiatedBy: string;
}

export interface ProjectIdentity {
  environmentProjectId: string;
  serviceAccountProjectId: string;
}

export interface BackfillReport {
  mode: "DRY_RUN" | "APPLY";
  migrationId: string;
  projectId: string;
  processedFacilities: number;
  processedUsers: number;
  processedAssignments: number;
  scannedProfiles: number;
  plannedEntityWrites: number;
  plannedAuditWrites: number;
  writtenEntityCount: number;
  writtenAuditCount: number;
  issueCounts: Partial<Record<BackfillIssueCode, number>>;
  issueSamples: BackfillIssue[];
}

export interface BackfillMigrationState extends FacilityAccessMigrationState {
  stage: BackfillStage;
  last_processed_facility_id: string | null;
  last_processed_assignment_id: string | null;
  last_scanned_profile_id: string | null;
  processed_facility_count: number;
  processed_assignment_count: number;
  scanned_profile_count: number;
  issue_counts: Partial<Record<BackfillIssueCode, number>>;
}

export interface RuntimeContext {
  options: BackfillOptions;
  projectId: string;
  sourceFingerprint: string;
  leaseOwner: string;
  report: BackfillReport;
}

export const createBackfillReport = (
  options: BackfillOptions,
  projectId: string,
): BackfillReport => ({
  mode: options.apply ? "APPLY" : "DRY_RUN",
  migrationId: options.migrationId,
  projectId,
  processedFacilities: 0,
  processedUsers: 0,
  processedAssignments: 0,
  scannedProfiles: 0,
  plannedEntityWrites: 0,
  plannedAuditWrites: 0,
  writtenEntityCount: 0,
  writtenAuditCount: 0,
  issueCounts: {},
  issueSamples: [],
});

export const recordIssue = (
  report: BackfillReport,
  issue: BackfillIssue,
): void => {
  report.issueCounts[issue.code] = (report.issueCounts[issue.code] ?? 0) + 1;
  if (report.issueSamples.length < 100) report.issueSamples.push(issue);
};
