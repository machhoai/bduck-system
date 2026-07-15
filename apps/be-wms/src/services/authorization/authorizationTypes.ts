import type {
  ActiveStatus,
  FacilityAccessGrantSource,
  OfficeScopeConfig,
  OfficeScopeEdge,
  Role,
  UserStatus,
  UserWarehouseRole,
  Warehouse,
  WarehouseType,
} from "@bduck/shared-types";

export type AuthorizationDate = Date | string;

export interface AuthorizationActor {
  id: string;
  status: UserStatus;
  is_deleted: boolean;
  workplace_facility_id?: string | null;
}

export type AuthorizationFacility = Pick<
  Warehouse,
  "id" | "type" | "status" | "is_deleted"
> & {
  is_active?: boolean;
  valid_from?: AuthorizationDate | null;
  valid_until?: AuthorizationDate | null;
};

/** Optional activity fields support the current role schema and its next revision. */
export type AuthorizationRole = Pick<
  Role,
  "id" | "name" | "permissions" | "is_deleted"
> & {
  is_active?: boolean;
  status?: ActiveStatus;
  valid_from?: AuthorizationDate | null;
  valid_until?: AuthorizationDate | null;
};

export type AuthorizationAssignment = Pick<
  UserWarehouseRole,
  | "id"
  | "user_id"
  | "warehouse_id"
  | "role_id"
  | "is_active"
  | "is_deleted"
  | "scope_origin"
> & {
  valid_from: AuthorizationDate | null;
  valid_until: AuthorizationDate | null;
};

export type AuthorizationOfficeScopeConfig = Pick<
  OfficeScopeConfig,
  | "id"
  | "office_id"
  | "scope_mode"
  | "is_active"
  | "is_deleted"
  | "policy_version"
  | "revision"
  | "valid_from"
  | "valid_until"
>;

export type AuthorizationOfficeScopeEdge = Pick<
  OfficeScopeEdge,
  | "id"
  | "office_id"
  | "target_facility_id"
  | "is_active"
  | "is_deleted"
  | "valid_from"
  | "valid_until"
>;

export interface AuthorizationSourceSnapshot {
  actor: AuthorizationActor | null;
  facilities: readonly AuthorizationFacility[];
  roles: readonly AuthorizationRole[];
  assignments: readonly AuthorizationAssignment[];
  officeScopeConfigs: readonly AuthorizationOfficeScopeConfig[];
  officeScopeEdges: readonly AuthorizationOfficeScopeEdge[];
  now?: Date;
  dateOnlyTimeZone?: string;
}

export interface AccessContextGrantSeed {
  facilityId: string;
  facilityType: WarehouseType;
  permissions: Readonly<Record<string, boolean>>;
  sources: readonly FacilityAccessGrantSource[];
}

/**
 * Stable input boundary for Phase 3 materialized grants. The raw-policy builder
 * resolves into this shape; a repository can later produce the same seed.
 */
export interface AccessContextSeed {
  actorId: string;
  workplaceFacilityId: string | null;
  isSystemAdmin: boolean;
  systemAdminSources?: readonly FacilityAccessGrantSource[];
  policyVersion: string;
  computedAt: Date;
  grants: readonly AccessContextGrantSeed[];
}

export interface AccessContextFacilityGrant {
  facilityId: string;
  facilityType: WarehouseType;
  permissions: Readonly<Record<string, boolean>>;
  sources: readonly FacilityAccessGrantSource[];
}

declare const accessContextBrand: unique symbol;

export interface AccessContext {
  readonly [accessContextBrand]: true;
  actorId: string;
  workplaceFacilityId: string | null;
  isSystemAdmin: boolean;
  systemAdminSources: readonly FacilityAccessGrantSource[];
  policyVersion: string;
  computedAt: string;
  grants: Readonly<Record<string, AccessContextFacilityGrant>>;
}
