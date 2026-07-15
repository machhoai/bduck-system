import {
  ActiveStatus,
  EmployeeProfileStatus,
  FACILITY_ACCESS_POLICY_VERSION,
  UserStatus,
  WarehouseType,
} from "@bduck/shared-types";
import type { AuthorizationSourceReader } from "./authorizationSourceLoader.js";
import type { AuthorizationSourceDocument } from "./authorizationSourceMapper.js";

export const NOW = new Date("2026-07-15T05:00:00.000Z");
export const document = (
  id: string,
  data: Record<string, unknown>,
): AuthorizationSourceDocument => ({ id, data });
export const activeUser = (workplace: string | null = "office-a") =>
  document("user-a", {
    status: UserStatus.ACTIVE,
    is_deleted: false,
    workplace_facility_id: workplace,
  });
export const activeProfile = (workplace = "office-a") =>
  document("profile-a", {
    user_id: "user-a",
    status: EmployeeProfileStatus.ACTIVE,
    is_deleted: false,
    workplace_warehouse_id: workplace,
  });
export const assignment = (
  warehouseId: string | null,
  roleId = "reader",
  overrides: Record<string, unknown> = {},
) =>
  document(`assignment-${roleId}-${warehouseId ?? "global"}`, {
    user_id: "user-a",
    warehouse_id: warehouseId,
    role_id: roleId,
    is_active: true,
    is_deleted: false,
    scope_origin: "DIRECT",
    valid_from: "2026-01-01",
    valid_until: null,
    ...overrides,
  });
export const role = (
  id = "reader",
  permissions: Record<string, boolean> = { "inventory.read": true },
  overrides: Record<string, unknown> = {},
) =>
  document(id, {
    name: id,
    permissions,
    is_deleted: false,
    ...overrides,
  });
export const facility = (
  id: string,
  type: WarehouseType,
  overrides: Record<string, unknown> = {},
) =>
  document(id, {
    type,
    status: ActiveStatus.ACTIVE,
    is_deleted: false,
    ...overrides,
  });
export const config = (mode: "ALL" | "SELECTED", overrides = {}) =>
  document("office-a", {
    office_id: "office-a",
    scope_mode: mode,
    is_active: true,
    is_deleted: false,
    policy_version: FACILITY_ACCESS_POLICY_VERSION,
    revision: 1,
    valid_from: null,
    valid_until: null,
    ...overrides,
  });
export const edge = (
  targetId: string,
  overrides: Record<string, unknown> = {},
) =>
  document(`office-a:${targetId}`, {
    office_id: "office-a",
    target_facility_id: targetId,
    is_active: true,
    is_deleted: false,
    valid_from: null,
    valid_until: null,
    ...overrides,
  });

export interface HarnessState {
  user?: AuthorizationSourceDocument | null;
  profiles?: AuthorizationSourceDocument[];
  assignments?: AuthorizationSourceDocument[];
  roles?: AuthorizationSourceDocument[];
  facilities?: AuthorizationSourceDocument[];
  allFacilities?: AuthorizationSourceDocument[];
  officeConfig?: AuthorizationSourceDocument | null;
  officeEdges?: AuthorizationSourceDocument[];
}

export const createHarness = (state: HarnessState = {}) => {
  const calls = {
    users: 0,
    assignments: 0,
    allFacilities: 0,
    roleIds: [] as string[][],
    facilityIds: [] as string[][],
    officeConfig: 0,
    officeEdges: 0,
  };
  const reader: AuthorizationSourceReader = {
    getUser: async () => {
      calls.users += 1;
      return state.user === undefined ? activeUser() : state.user;
    },
    findProfiles: async () => state.profiles ?? [activeProfile()],
    findAssignments: async () => {
      calls.assignments += 1;
      return state.assignments ?? [];
    },
    getRoles: async (ids) => {
      calls.roleIds.push([...ids]);
      const requested = new Set(ids);
      return (state.roles ?? []).filter(({ id }) => requested.has(id));
    },
    getFacilities: async (ids) => {
      calls.facilityIds.push([...ids]);
      const requested = new Set(ids);
      return (state.facilities ?? []).filter(({ id }) => requested.has(id));
    },
    findAllFacilityCandidates: async () => {
      calls.allFacilities += 1;
      return state.allFacilities ?? [];
    },
    getOfficeConfig: async () => {
      calls.officeConfig += 1;
      return state.officeConfig ?? null;
    },
    findOfficeEdges: async () => {
      calls.officeEdges += 1;
      return state.officeEdges ?? [];
    },
  };
  return { calls, reader };
};
