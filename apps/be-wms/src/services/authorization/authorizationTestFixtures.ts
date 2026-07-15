import assert from "node:assert/strict";
import {
  ActiveStatus,
  FACILITY_ACCESS_POLICY_VERSION,
  UserStatus,
  WarehouseType,
} from "@bduck/shared-types";
import {
  AuthorizationError,
  type AuthorizationErrorCode,
} from "./authorizationError.js";
import type {
  AuthorizationActor,
  AuthorizationAssignment,
  AuthorizationFacility,
  AuthorizationOfficeScopeConfig,
  AuthorizationOfficeScopeEdge,
  AuthorizationRole,
  AuthorizationSourceSnapshot,
} from "./authorizationTypes.js";

export const TEST_NOW = new Date("2026-07-15T05:00:00.000Z");

export const createActor = (
  overrides: Partial<AuthorizationActor> = {},
): AuthorizationActor => ({
  id: "user-1",
  status: UserStatus.ACTIVE,
  is_deleted: false,
  workplace_facility_id: "office-a",
  ...overrides,
});

export const createFacility = (
  id: string,
  type: WarehouseType,
  overrides: Partial<AuthorizationFacility> = {},
): AuthorizationFacility => ({
  id,
  type,
  status: ActiveStatus.ACTIVE,
  is_deleted: false,
  ...overrides,
});

export const createRole = (
  id: string,
  permissions: Record<string, boolean>,
  overrides: Partial<AuthorizationRole> = {},
): AuthorizationRole => ({
  id,
  name: id,
  permissions,
  is_deleted: false,
  ...overrides,
});

export const createAssignment = (
  id: string,
  warehouseId: string | null,
  roleId: string,
  overrides: Partial<AuthorizationAssignment> = {},
): AuthorizationAssignment => ({
  id,
  user_id: "user-1",
  warehouse_id: warehouseId,
  role_id: roleId,
  is_active: true,
  is_deleted: false,
  scope_origin: "DIRECT",
  valid_from: "2026-01-01",
  valid_until: null,
  ...overrides,
});

export const createConfig = (
  officeId: string,
  scopeMode: "ALL" | "SELECTED",
  overrides: Partial<AuthorizationOfficeScopeConfig> = {},
): AuthorizationOfficeScopeConfig => ({
  id: officeId,
  office_id: officeId,
  scope_mode: scopeMode,
  is_active: true,
  is_deleted: false,
  policy_version: FACILITY_ACCESS_POLICY_VERSION,
  revision: 1,
  valid_from: null,
  valid_until: null,
  ...overrides,
});

export const createEdge = (
  officeId: string,
  targetFacilityId: string,
  overrides: Partial<AuthorizationOfficeScopeEdge> = {},
): AuthorizationOfficeScopeEdge => ({
  id: `${officeId}:${targetFacilityId}`,
  office_id: officeId,
  target_facility_id: targetFacilityId,
  is_active: true,
  is_deleted: false,
  valid_from: null,
  valid_until: null,
  ...overrides,
});

export const createSnapshot = (
  overrides: Partial<AuthorizationSourceSnapshot> = {},
): AuthorizationSourceSnapshot => ({
  actor: createActor(),
  facilities: [createFacility("office-a", WarehouseType.OFFICE)],
  roles: [],
  assignments: [],
  officeScopeConfigs: [],
  officeScopeEdges: [],
  now: TEST_NOW,
  dateOnlyTimeZone: "Asia/Ho_Chi_Minh",
  ...overrides,
});

export const expectAuthorizationCode = (
  callback: () => unknown,
  code: AuthorizationErrorCode,
): void => {
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof AuthorizationError && error.code === code,
  );
};
