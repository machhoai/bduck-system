import { createHash, randomUUID } from "node:crypto";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  type FacilityAccessMigrationState,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  getFacilityAccessMigrationRef,
  getFacilityAccessMigrationStateInTransaction,
} from "../repositories/facilityAccessMigrationRepository.js";
import { facilityAccessMigrationOptionsSchema } from "../utils/facilityAccessSchemas.js";
import {
  createBackfillReport,
  type BackfillMigrationState,
  type BackfillOptions,
  type RuntimeContext,
} from "./facilityAccessBackfillTypes.js";
import { validateMigrationLeaseHolder } from "./facilityAccessBackfillProgress.js";

const LEASE_DURATION_MS = 5 * 60 * 1000;
const SOURCE_SCHEMA =
  "workplace-profile+legacy-direct+empty-office-selected:v1";

const readArgument = (name: string): string | undefined => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

export const parseBackfillOptions = (): BackfillOptions => {
  const parsed = facilityAccessMigrationOptionsSchema.parse({
    apply: process.argv.includes("--apply"),
    resume: process.argv.includes("--resume"),
    batch_size: readArgument("batch-size"),
    migration_id: readArgument("migration-id"),
    confirm_project: readArgument("confirm-project"),
    initiated_by: readArgument("initiated-by"),
  });

  return {
    apply: parsed.apply,
    resume: parsed.resume,
    batchSize: parsed.batch_size,
    migrationId: parsed.migration_id,
    confirmProject: parsed.confirm_project,
    initiatedBy: parsed.initiated_by,
  };
};

const readServiceAccountProjectId = (): string | null => {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) return null;
  const data = JSON.parse(
    Buffer.from(encoded, "base64").toString("utf8"),
  ) as Record<string, unknown>;
  const value = data.project_id ?? data.projectId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const resolveProjectId = (options: BackfillOptions): string => {
  const environmentProjectId =
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null;
  const serviceAccountProjectId = readServiceAccountProjectId();

  if (
    environmentProjectId &&
    serviceAccountProjectId &&
    environmentProjectId !== serviceAccountProjectId
  ) {
    throw new Error("FIREBASE_PROJECT_IDENTITY_MISMATCH");
  }

  const projectId = environmentProjectId || serviceAccountProjectId;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID_NOT_RESOLVED");
  if (options.apply && options.confirmProject !== projectId) {
    throw new Error(`APPLY_REQUIRES_EXACT_CONFIRM_PROJECT:${projectId}`);
  }
  return projectId;
};

export const createRuntimeContext = (
  options: BackfillOptions,
  projectId: string,
): RuntimeContext => ({
  options,
  projectId,
  sourceFingerprint: createHash("sha256")
    .update(`${FACILITY_ACCESS_POLICY_VERSION}:${SOURCE_SCHEMA}`)
    .digest("hex"),
  leaseOwner: randomUUID(),
  report: createBackfillReport(options, projectId),
});

const initialState = (
  context: RuntimeContext,
  now: Date,
): BackfillMigrationState => ({
  id: context.options.migrationId,
  migration_key: context.options.migrationId,
  migration_version: 1,
  run_id: context.leaseOwner,
  mode: "APPLY",
  phase: "BACKFILL",
  policy_version: FACILITY_ACCESS_POLICY_VERSION,
  source_fingerprint: context.sourceFingerprint,
  stage: "OFFICE_CONFIGS",
  last_processed_facility_id: null,
  last_processed_user_id: null,
  last_processed_assignment_id: null,
  last_scanned_profile_id: null,
  lease_owner: context.leaseOwner,
  lease_expires_at: new Date(now.getTime() + LEASE_DURATION_MS),
  processed_facility_count: 0,
  processed_user_count: 0,
  processed_assignment_count: 0,
  scanned_profile_count: 0,
  planned_write_count: 0,
  written_count: 0,
  skipped_user_count: 0,
  conflict_count: 0,
  failed_user_count: 0,
  issue_counts: {},
  started_at: now,
  completed_at: null,
  last_error: null,
  initiated_by: context.options.initiatedBy,
  is_deleted: false,
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});

export const acquireMigrationLease = async (
  context: RuntimeContext,
): Promise<BackfillMigrationState | null> => {
  if (!context.options.apply) return null;
  return db.runTransaction(async (transaction) => {
    const now = new Date();
    const existing = (await getFacilityAccessMigrationStateInTransaction(
      transaction,
      context.options.migrationId,
      true,
    )) as BackfillMigrationState | null;

    if (!existing) {
      const state = initialState(context, now);
      transaction.create(getFacilityAccessMigrationRef(state.id), state);
      return state;
    }
    if (existing.is_deleted) throw new Error("MIGRATION_STATE_SOFT_DELETED");
    if (existing.phase === "COMPLETED") return existing;
    if (!context.options.resume) throw new Error("MIGRATION_EXISTS_USE_RESUME");
    if (
      existing.mode !== "APPLY" ||
      existing.policy_version !== FACILITY_ACCESS_POLICY_VERSION ||
      existing.source_fingerprint !== context.sourceFingerprint
    ) {
      throw new Error("MIGRATION_RESUME_FINGERPRINT_MISMATCH");
    }
    if (
      existing.lease_owner &&
      existing.lease_owner !== context.leaseOwner &&
      existing.lease_expires_at &&
      existing.lease_expires_at.getTime() > now.getTime()
    ) {
      throw new Error("MIGRATION_LEASE_HELD");
    }

    transaction.update(getFacilityAccessMigrationRef(existing.id), {
      run_id: context.leaseOwner,
      phase: "BACKFILL",
      lease_owner: context.leaseOwner,
      lease_expires_at: new Date(now.getTime() + LEASE_DURATION_MS),
      updated_at: now,
      sync_time: now,
      last_error: null,
    });
    return {
      ...existing,
      run_id: context.leaseOwner,
      phase: "BACKFILL",
      lease_owner: context.leaseOwner,
    };
  });
};

export const checkpointMigration = async (
  context: RuntimeContext,
  patch: Record<string, unknown>,
): Promise<void> => {
  if (!context.options.apply) return;
  await db.runTransaction(async (transaction) => {
    const state = await getFacilityAccessMigrationStateInTransaction(
      transaction,
      context.options.migrationId,
    );
    const now = new Date();
    const lease = validateMigrationLeaseHolder(
      {
        exists: state !== null,
        leaseOwner: state?.lease_owner,
        leaseExpiresAt: state?.lease_expires_at,
      },
      context.leaseOwner,
      now,
    );
    if (!lease.valid || !state) {
      throw new Error("MIGRATION_LEASE_LOST");
    }
    transaction.update(getFacilityAccessMigrationRef(state.id), {
      ...patch,
      lease_expires_at: Object.hasOwn(patch, "lease_expires_at")
        ? patch.lease_expires_at
        : new Date(now.getTime() + LEASE_DURATION_MS),
      updated_at: now,
      action_time: now,
      sync_time: now,
    });
  });
};

export const failMigration = async (
  context: RuntimeContext,
  error: unknown,
): Promise<void> => {
  if (!context.options.apply) return;
  await checkpointMigration(context, {
    phase: "FAILED",
    lease_owner: null,
    lease_expires_at: null,
    last_error: error instanceof Error ? error.message : String(error),
  });
};

export const releaseCompletedMigration = async (
  context: RuntimeContext,
): Promise<void> =>
  checkpointMigration(context, {
    phase: "COMPLETED",
    stage: "COMPLETED",
    completed_at: new Date(),
    lease_owner: null,
    lease_expires_at: null,
    last_error: null,
  });

export const isCompletedState = (
  state: FacilityAccessMigrationState | null,
): boolean => state?.phase === "COMPLETED";
