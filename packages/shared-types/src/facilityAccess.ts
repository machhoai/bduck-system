import type { ISOTimestamped, SoftDeletable } from "./utility.js";
import type { ActiveStatus, AuditAction, WarehouseType } from "./enums.js";

export const FACILITY_ACCESS_POLICY_VERSION = "office-scope-v1" as const;

// Firestore collection names are shared to prevent path drift between clients,
// security rules helpers, migration scripts, and backend repositories.
export const OFFICE_SCOPE_CONFIGS_COLLECTION = "office_scope_configs" as const;
export const OFFICE_SCOPE_EDGES_COLLECTION = "office_scope_edges" as const;
export const OFFICE_SCOPE_CEILINGS_COLLECTION =
  "office_scope_ceilings" as const;
export const OFFICE_SCOPE_MATERIALIZATIONS_COLLECTION =
  "office_scope_materializations" as const;
export const OFFICE_SCOPE_MATERIALIZATION_JOBS_COLLECTION =
  "office_scope_materialization_jobs" as const;
export const USER_ACCESS_COLLECTION = "user_access" as const;
export const USER_ACCESS_VERSIONS_SUBCOLLECTION = "versions" as const;
export const USER_ACCESS_FACILITIES_SUBCOLLECTION = "facilities" as const;
export const USER_ACCESS_REBUILD_LOCKS_COLLECTION =
  "user_access_rebuild_locks" as const;
export const USER_ACCESS_REBUILD_REQUESTS_COLLECTION =
  "user_access_rebuild_requests" as const;
export const FACILITY_ACCESS_MIGRATIONS_COLLECTION =
  "facility_access_migrations" as const;

export const OFFICE_SCOPE_MODES = ["ALL", "SELECTED"] as const;
export type OfficeScopeMode = (typeof OFFICE_SCOPE_MODES)[number];

export const OFFICE_SCOPE_MATERIALIZATION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const;
export type OfficeScopeMaterializationStatus =
  (typeof OFFICE_SCOPE_MATERIALIZATION_STATUSES)[number];

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

/** Frontend lifecycle for a materialized access snapshot. */
export const USER_ACCESS_RUNTIME_STATUSES = [
  "SIGNED_OUT",
  "VERIFYING",
  "READY",
  "OFFLINE_READY",
  "OFFLINE_UNVERIFIED",
  "REVOKED",
  "ERROR",
] as const;
export type UserAccessRuntimeStatus =
  (typeof USER_ACCESS_RUNTIME_STATUSES)[number];

export const USER_ACCESS_REBUILD_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const;
export type UserAccessRebuildStatus =
  (typeof USER_ACCESS_REBUILD_STATUSES)[number];

export interface UserAccessRebuildRequest
  extends SoftDeletable, ISOTimestamped {
  id: string;
  user_id: string;
  status: UserAccessRebuildStatus;
  reasons: string[];
  revision: number;
  attempts: number;
  requested_by: string;
  requested_at: Date;
  completed_at: Date | null;
  materialized_access_version: number | null;
  last_error: string | null;
}

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

/** Stable delegated-management ceiling. Only the ceiling policy may expand it. */
export interface OfficeScopeCeilingConfig
  extends SoftDeletable, ISOTimestamped {
  id: string;
  office_id: string;
  scope_mode: OfficeScopeMode;
  target_facility_ids: string[];
  revision: number;
  created_by: string;
  updated_by: string;
}

/** Public, user-ID-free status for one scope revision materialization. */
export interface OfficeScopeMaterialization extends ISOTimestamped {
  id: string;
  office_id: string;
  scope_revision: number;
  status: OfficeScopeMaterializationStatus;
  requested_count: number;
  completed_count: number;
  failed_count: number;
  attempts: number;
  started_at: Date;
  completed_at: Date | null;
  requested_by: string;
  last_error: string | null;
}

/** Minimal facility directory record exposed to an authorized scope editor. */
export interface OfficeScopeFacilityOption {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  status: ActiveStatus;
}

/** Read model used by the office scope management screen. */
export interface OfficeScopeSnapshot {
  config: OfficeScopeConfig | null;
  ceiling: OfficeScopeCeilingConfig | null;
  edges: OfficeScopeEdge[];
  effective_facility_ids: string[];
  editable_facility_ids: string[];
  editable_facilities: OfficeScopeFacilityOption[];
  affected_employee_count: number;
}

/** Sanitized audit read model for one Office scope revision. */
export interface OfficeScopeHistoryEntry {
  id: string;
  office_id: string;
  revision: number;
  action: AuditAction;
  actor_id: string;
  actor_name: string | null;
  action_time: Date;
  sync_time: Date;
  previous_mode: OfficeScopeMode | null;
  next_mode: OfficeScopeMode;
  previous_selected_facility_ids: string[];
  next_selected_facility_ids: string[];
  added_facility_ids: string[];
  removed_facility_ids: string[];
  affected_employee_count: number | null;
  materialization: OfficeScopeMaterialization | null;
}

/** Mutation contract with optimistic concurrency for Office scope edits. */
export interface OfficeScopeUpdateRequest {
  scope_mode: OfficeScopeMode;
  target_facility_ids: string[];
  expected_revision: number;
  valid_from?: string | null;
  valid_until?: string | null;
}

/** System-admin-only mutation contract for the delegated management ceiling. */
export interface OfficeScopeCeilingUpdateRequest {
  scope_mode: OfficeScopeMode;
  target_facility_ids: string[];
  expected_revision: number;
}

export const OFFICE_SCOPE_OVERVIEW_STATUSES = [
  "UNCONFIGURED",
  "INACTIVE",
  "EMPTY",
  "ACTIVE",
] as const;
export type OfficeScopeOverviewStatus =
  (typeof OFFICE_SCOPE_OVERVIEW_STATUSES)[number];

/** Compact, permission-filtered read model for the Office scope overview. */
export interface OfficeScopeOverviewItem {
  office_id: string;
  office_name: string;
  office_code: string;
  office_status: ActiveStatus;
  scope_status: OfficeScopeOverviewStatus;
  scope_mode: OfficeScopeMode | null;
  revision: number;
  effective_facility_count: number;
  affected_employee_count: number;
  updated_at: Date | null;
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
  facility_type: WarehouseType;
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
  system_admin_sources: FacilityAccessGrantSource[];
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
  system_admin_sources: FacilityAccessGrantSource[];
  active_version_id: string | null;
  access_version: number;
  policy_version: string;
  source_fingerprint: string;
  facility_grant_count: number;
  computed_at: Date;
  computed_by: string;
  migration_version: number | null;
}

/** Read-only effective access shown in employee and user administration. */
export interface UserEffectiveAccessSnapshot {
  metadata: UserAccessMetadata | null;
  grants: UserFacilityAccessGrant[];
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
