import type {
  BackfillIssue,
  BackfillStage,
} from "./facilityAccessBackfillTypes.js";

export type MigrationCursorField =
  | "last_processed_facility_id"
  | "last_processed_user_id"
  | "last_processed_assignment_id"
  | "last_scanned_profile_id";

export type MigrationCounterField =
  | "processed_facility_count"
  | "processed_user_count"
  | "processed_assignment_count"
  | "scanned_profile_count";

export interface MigrationItemProgress {
  stage: BackfillStage;
  cursorField: MigrationCursorField;
  cursorValue: string;
  counterField: MigrationCounterField;
  issues: BackfillIssue[];
}

export interface MigrationItemProgressDelta {
  cursorField: MigrationCursorField;
  cursorValue: string;
  counterField: MigrationCounterField;
  counterIncrement: 1;
  plannedWriteIncrement: number;
  writtenWriteIncrement: number;
  issueCountIncrements: Record<string, number>;
}

export type MigrationLeaseFailureReason =
  | "STATE_MISSING"
  | "WRONG_OWNER"
  | "WRONG_STAGE"
  | "LEASE_EXPIRED";

export type MigrationLeaseValidation =
  | { valid: true; expiresAt: Date }
  | { valid: false; reason: MigrationLeaseFailureReason };

export interface MigrationLeaseHolderStateInput {
  exists: boolean;
  leaseOwner: unknown;
  leaseExpiresAt: unknown;
}

export interface MigrationLeaseStateInput extends MigrationLeaseHolderStateInput {
  stage: unknown;
}

interface TimestampLike {
  toDate: () => Date;
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  ) {
    const converted = (value as TimestampLike).toDate();
    return converted instanceof Date ? converted : null;
  }
  return null;
};

export const validateMigrationLeaseHolder = (
  state: MigrationLeaseHolderStateInput,
  expectedOwner: string,
  now: Date,
): MigrationLeaseValidation => {
  if (!state.exists) return { valid: false, reason: "STATE_MISSING" };
  if (state.leaseOwner !== expectedOwner) {
    return { valid: false, reason: "WRONG_OWNER" };
  }

  const expiresAt = toDate(state.leaseExpiresAt);
  if (
    !expiresAt ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime()
  ) {
    return { valid: false, reason: "LEASE_EXPIRED" };
  }
  return { valid: true, expiresAt };
};

export const validateMigrationLease = (
  state: MigrationLeaseStateInput,
  expectedOwner: string,
  expectedStage: BackfillStage,
  now: Date,
): MigrationLeaseValidation => {
  const holder = validateMigrationLeaseHolder(state, expectedOwner, now);
  if (!holder.valid) return holder;
  if (state.stage !== expectedStage) {
    return { valid: false, reason: "WRONG_STAGE" };
  }
  return holder;
};

export const buildMigrationItemProgressDelta = (
  progress: MigrationItemProgress,
  plannedWrites: number,
  writtenWrites: number,
): MigrationItemProgressDelta => {
  const issueCountIncrements = progress.issues.reduce<Record<string, number>>(
    (counts, issue) => {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return {
    cursorField: progress.cursorField,
    cursorValue: progress.cursorValue,
    counterField: progress.counterField,
    counterIncrement: 1,
    plannedWriteIncrement: plannedWrites,
    writtenWriteIncrement: writtenWrites,
    issueCountIncrements,
  };
};
