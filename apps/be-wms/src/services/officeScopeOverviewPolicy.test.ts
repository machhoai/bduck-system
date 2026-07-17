import assert from "node:assert/strict";
import test from "node:test";
import {
  ActiveStatus,
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type OfficeScopeConfig,
  type OfficeScopeEdge,
  type Warehouse,
} from "@bduck/shared-types";
import {
  AuthorizationService,
  createAccessContext,
} from "./authorization/index.js";
import {
  buildOfficeScopeOverview,
  createOfficeScopeOverviewReadScope,
} from "./officeScopeOverviewPolicy.js";

const now = new Date("2026-07-17T00:00:00.000Z");
const source = {
  type: "DIRECT" as const,
  role_id: "role-office",
  assignment_id: "assignment-office",
  office_id: null,
};
const facility = (id: string, type: WarehouseType): Warehouse => ({
  id,
  organization_id: "organization-a",
  name: id,
  code: id.toUpperCase(),
  type,
  address: null,
  manager_id: null,
  status: ActiveStatus.ACTIVE,
  warehouse_description: null,
  warehouse_image_url: null,
  is_deleted: false,
  created_at: now,
  updated_at: now,
  coordinate: null,
});
const config = (officeId: string): OfficeScopeConfig => ({
  id: officeId,
  office_id: officeId,
  scope_mode: "SELECTED",
  is_active: true,
  policy_version: FACILITY_ACCESS_POLICY_VERSION,
  revision: 2,
  valid_from: null,
  valid_until: null,
  created_by: "admin",
  updated_by: "admin",
  is_deleted: false,
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});
const edge = (id: string, officeId: string, targetId: string): OfficeScopeEdge => ({
  id,
  office_id: officeId,
  target_facility_id: targetId,
  is_active: true,
  valid_from: null,
  valid_until: null,
  created_by: "admin",
  updated_by: "admin",
  is_deleted: false,
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});

test("builds the list query scope from office_scopes.read only", () => {
  const authorization = new AuthorizationService(
    createAccessContext({
      actorId: "office-a-manager",
      workplaceFacilityId: "office-a",
      isSystemAdmin: false,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: now,
      grants: [
        {
          facilityId: "office-a",
          facilityType: WarehouseType.OFFICE,
          permissions: { "office_scopes.read": true },
          sources: [source],
        },
        {
          facilityId: "office-b",
          facilityType: WarehouseType.OFFICE,
          permissions: { "warehouses.read": true },
          sources: [source],
        },
        {
          facilityId: "warehouse-c",
          facilityType: WarehouseType.MAIN,
          permissions: { "office_scopes.read": true },
          sources: [source],
        },
      ],
    }),
  );

  assert.deepEqual(createOfficeScopeOverviewReadScope(authorization), {
    isSystemAdmin: false,
    facilityIds: ["office-a", "warehouse-c"],
  });
});

test("does not expose offices or targets outside the readable partition", () => {
  const overview = buildOfficeScopeOverview({
    facilities: [
      facility("office-a", WarehouseType.OFFICE),
      facility("warehouse-c", WarehouseType.MAIN),
    ],
    configs: [config("office-a"), config("office-b")],
    edges: [
      edge("edge-c", "office-a", "warehouse-c"),
      edge("edge-d", "office-a", "store-d"),
    ],
    employeeCounts: { "office-a": 3, "office-b": 7 },
    at: now,
  });

  assert.equal(overview.length, 1);
  assert.equal(overview[0].office_id, "office-a");
  assert.equal(overview[0].effective_facility_count, 1);
  assert.equal(overview[0].affected_employee_count, 3);
});

test("marks a new empty selected scope explicitly", () => {
  const overview = buildOfficeScopeOverview({
    facilities: [facility("office-a", WarehouseType.OFFICE)],
    configs: [{ ...config("office-a"), revision: 1 }],
    edges: [],
    employeeCounts: {},
    at: now,
  });

  assert.equal(overview[0].scope_status, "EMPTY");
  assert.equal(overview[0].scope_mode, "SELECTED");
  assert.equal(overview[0].revision, 1);
});
