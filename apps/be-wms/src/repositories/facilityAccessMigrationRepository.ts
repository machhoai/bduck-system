import {
  FACILITY_ACCESS_MIGRATIONS_COLLECTION,
  type FacilityAccessMigrationState,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

type MigrationStatePatch = Partial<
  Omit<FacilityAccessMigrationState, "id" | "migration_key" | "created_at">
>;

export interface FacilityAccessMigrationWritePlan {
  ref: FirebaseFirestore.DocumentReference;
  data: FacilityAccessMigrationState | MigrationStatePatch;
  merge: boolean;
}

const REQUIRED_DATE_FIELDS = [
  "created_at",
  "updated_at",
  "action_time",
  "sync_time",
];

const mapMigrationState = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): FacilityAccessMigrationState =>
  mapFirestoreDocument<FacilityAccessMigrationState>(
    snapshot,
    REQUIRED_DATE_FIELDS,
    ["started_at", "completed_at", "lease_expires_at"],
  );

export const getFacilityAccessMigrationsCollectionRef = () =>
  db.collection(FACILITY_ACCESS_MIGRATIONS_COLLECTION);

export const getFacilityAccessMigrationRef = (migrationId: string) =>
  getFacilityAccessMigrationsCollectionRef().doc(migrationId);

export const getFacilityAccessMigrationState = async (
  migrationId: string,
  includeDeleted = false,
): Promise<FacilityAccessMigrationState | null> => {
  const snapshot = await getFacilityAccessMigrationRef(migrationId).get();
  if (!snapshot.exists) return null;

  const state = mapMigrationState(snapshot);
  return !includeDeleted && state.is_deleted ? null : state;
};

export const getFacilityAccessMigrationStateInTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  migrationId: string,
  includeDeleted = false,
): Promise<FacilityAccessMigrationState | null> => {
  const snapshot = await transaction.get(
    getFacilityAccessMigrationRef(migrationId),
  );
  if (!snapshot.exists) return null;

  const state = mapMigrationState(snapshot);
  return !includeDeleted && state.is_deleted ? null : state;
};

export const findFacilityAccessMigrationStates = async (
  includeDeleted = false,
): Promise<FacilityAccessMigrationState[]> => {
  const snapshot = await getFacilityAccessMigrationsCollectionRef().get();
  return snapshot.docs
    .map(mapMigrationState)
    .filter((state) => includeDeleted || !state.is_deleted)
    .sort((left, right) => right.migration_version - left.migration_version);
};

export const findFacilityAccessMigrationStateByKey = async (
  migrationKey: string,
  includeDeleted = false,
): Promise<FacilityAccessMigrationState | null> => {
  const snapshot = await getFacilityAccessMigrationsCollectionRef()
    .where("migration_key", "==", migrationKey)
    .get();

  return (
    snapshot.docs
      .map(mapMigrationState)
      .filter((state) => includeDeleted || !state.is_deleted)
      .sort(
        (left, right) => right.migration_version - left.migration_version,
      )[0] ?? null
  );
};

export const createFacilityAccessMigrationWritePlan = (
  state: FacilityAccessMigrationState,
): FacilityAccessMigrationWritePlan => ({
  ref: getFacilityAccessMigrationRef(state.id),
  data: state,
  merge: false,
});

export const createFacilityAccessMigrationCheckpointPlan = (
  migrationId: string,
  patch: MigrationStatePatch,
): FacilityAccessMigrationWritePlan => ({
  ref: getFacilityAccessMigrationRef(migrationId),
  data: patch,
  merge: true,
});

export const createFacilityAccessMigrationSoftDeletePlan = (
  migrationId: string,
  timestamps: { actionTime: Date; syncTime: Date },
): FacilityAccessMigrationWritePlan =>
  createFacilityAccessMigrationCheckpointPlan(migrationId, {
    phase: "FAILED",
    is_deleted: true,
    updated_at: timestamps.syncTime,
    action_time: timestamps.actionTime,
    sync_time: timestamps.syncTime,
  });

export const applyFacilityAccessMigrationWritePlanInTransaction = (
  transaction: FirebaseFirestore.Transaction,
  plan: FacilityAccessMigrationWritePlan,
): void => {
  transaction.set(plan.ref, plan.data, { merge: plan.merge });
};
