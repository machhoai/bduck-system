import type { ISOTimestamped, SoftDeletable } from "./utility.js";

export const FACILITY_ACCESS_POLICY_VERSION = "office-scope-v1" as const;

// Firestore collection names are shared to prevent path drift between clients,
// security rules helpers, migration scripts, and backend repositories.
export const OFFICE_SCOPE_CONFIGS_COLLECTION = "office_scope_configs" as const;
export const OFFICE_SCOPE_EDGES_COLLECTION = "office_scope_edges" as const;
export const USER_ACCESS_COLLECTION = "user_access" as const;
export const USER_ACCESS_VERSIONS_SUBCOLLECTION = "versions" as const;
export const USER_ACCESS_FACILITIES_SUBCOLLECTION = "facilities" as const;
export const FACILITY_ACCESS_MIGRATIONS_COLLECTION =
  "facility_access_migrations" as const;

export const OFFICE_SCOPE_MODES = ["ALL", "SELECTED"] as const;
export type OfficeScopeMode = (typeof OFFICE_SCOPE_MODES)[number];

/**
 * Distinguishes new direct role assignments from imported legacy assignments.
 * A LEGACY_DIRECT assignment remains direct; migration must never infer an
 * office-managed scope from it.
 */
export const USER_WAREHOUSE_ROLE_SCOPE_ORIGINS = [
  "DIRECT",
  "LEGACY_DIRECT",
] as const;
export type UserWarehouseRoleScopeOrigin =
  (typeof USER_WAREHOUSE_ROLE_SCOPE_ORIGINS)[number];

export const FACILITY_ACCESS_GRANT_SOURCE_TYPES = [
  "DIRECT",
  "LEGACY_DIRECT",
  "OFFICE_INHERITED",
  "SYSTEM_GLOBAL",
] as const;
export type FacilityAccessGrantSourceType =
  (typeof FACILITY_ACCESS_GRANT_SOURCE_TYPES)[number];

export const USER_ACCESS_VERSION_STATUSES = [
  "BUILDING",
  "ACTIVE",
  "RETIRED",
  "FAILED",
] as const;
export type UserAccessVersionStatus =
  (typeof USER_ACCESS_VERSION_STATUSES)[number];

export const FACILITY_ACCESS_MIGRATION_PHASES = [
  "NOT_STARTED",
  "BACKFILL",
  "SHADOW",
  "CUTOVER",
  "COMPLETED",
  "FAILED",
] as const;
export type FacilityAccessMigrationPhase =
  (typeof FACILITY_ACCESS_MIGRATION_PHASES)[number];

export const FACILITY_ACCESS_MIGRATION_MODES = ["DRY_RUN", "APPLY"] as const;
export type FacilityAccessMigrationMode =
  (typeof FACILITY_ACCESS_MIGRATION_MODES)[number];

/**
 * One active configuration per office facility.
 * ALL is dynamic and includes facilities created after the configuration.
 * SELECTED resolves access through active OfficeScopeEdge documents.
 */
export interface OfficeScopeConfig extends SoftDeletable, ISOTimestamped {
  id: string;
  office_id: string; // FK -> warehouses where type = OFFICE
  scope_mode: OfficeScopeMode;
  is_active: boolean;
  policy_version: string;
  revision: number;
  valid_from: Date | null;
  valid_until: Date | null; // Inclusive; null means no expiry
  created_by: string; // FK -> users
  updated_by: string; // FK -> users
}

/**
 * Explicit, non-transitive office-to-facility management relation.
 * Edges are only evaluated when the office config uses SELECTED mode.
 */
export interface OfficeScopeEdge extends SoftDeletable, ISOTimestamped {
  id: string;
  office_id: string; // FK -> warehouses where type = OFFICE
  target_facility_id: string; // FK -> warehouses
  is_active: boolean;
  valid_from: Date | null;
  valid_until: Date | null; // Inclusive; null means no expiry
  created_by: string; // FK -> users
  updated_by: string; // FK -> users
}

/** Describes every assignment that contributes to one effective grant. */
export interface FacilityAccessGrantSource {
  type: FacilityAccessGrantSourceType;
  role_id: string;
  assignment_id: string;
  /** Present only when the permission is inherited from an office scope. */
  office_id: string | null;
}

/**
 * Materialized effective permissions for one user and one facility.
 * The document ID should equal facility_id under
 * user_access/{userId}/versions/{versionId}/facilities/{facilityId}.
 */
export interface UserFacilityAccessGrant extends SoftDeletable, ISOTimestamped {
  id: string;
  user_id: string;
  facility_id: string;
  /** Temporary alias for consumers that still use warehouse terminology. */
  warehouse_id?: string;
  permissions: Record<string, boolean>;
  sources: FacilityAccessGrantSource[];
  access_version_id: string;
  access_version: number;
  computed_at: Date;
}

/**
 * Immutable grant snapshot. A completed version is activated atomically by
 * changing UserAccessMetadata.active_version_id; old versions remain auditable.
 */
export interface UserAccessVersion extends SoftDeletable, ISOTimestamped {
  id: string;
  user_id: string;
  version_number: number;
  status: UserAccessVersionStatus;
  policy_version: string;
  source_fingerprint: string;
  workplace_facility_id: string | null;
  /** Legacy alias retained while workplace data is being migrated. */
  workplace_warehouse_id?: string | null;
  is_global_admin: boolean;
  facility_grant_count: number;
  computed_at: Date;
  computed_by: string;
  activated_at: Date | null;
  retired_at: Date | null;
  migration_version: number | null;
}

/** Root metadata stored at user_access/{userId}. */
export interface UserAccessMetadata extends SoftDeletable, ISOTimestamped {
  id: string;
  user_id: string;
  workplace_facility_id: string | null;
  /** Legacy alias retained while workplace data is being migrated. */
  workplace_warehouse_id?: string | null;
  is_global_admin: boolean;
  active_version_id: string | null;
  access_version: number;
  policy_version: string;
  source_fingerprint: string;
  facility_grant_count: number;
  computed_at: Date;
  computed_by: string;
  migration_version: number | null;
}

/** Auditable, resumable state for the facility-access migration pipeline. */
export interface FacilityAccessMigrationState
  extends SoftDeletable, ISOTimestamped {
  id: string;
  migration_key: string;
  migration_version: number;
  run_id: string;
  mode: FacilityAccessMigrationMode;
  phase: FacilityAccessMigrationPhase;
  policy_version: string;
  source_fingerprint: string;
  last_processed_user_id: string | null;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  processed_user_count: number;
  planned_write_count: number;
  written_count: number;
  skipped_user_count: number;
  conflict_count: number;
  failed_user_count: number;
  started_at: Date | null;
  completed_at: Date | null;
  last_error: string | null;
  initiated_by: string; // FK -> users
}
