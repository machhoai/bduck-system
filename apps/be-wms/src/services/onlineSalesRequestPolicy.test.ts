import assert from "node:assert/strict";
import test from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
} from "@bduck/shared-types";
import {
  AuthorizationService,
  createAccessContext,
} from "./authorization/index.js";
import { authorizeOnlineSalesReportRequest } from "./onlineSalesRequestPolicy.js";

const STORE_A = "2c8411ef-f6fe-4a74-8d76-ebb0906b12f2";
const STORE_B = "9754779f-87f5-45c0-9dff-7df0e7ccc461";
const MAIN_A = "636df754-dd2c-49e0-86fe-6271581c95db";

const source = {
  type: "DIRECT" as const,
  role_id: "role-revenue",
  assignment_id: "assignment-revenue",
  office_id: null,
};

const authorization = new AuthorizationService(
  createAccessContext({
    actorId: "user-a",
    workplaceFacilityId: STORE_A,
    isSystemAdmin: false,
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt: new Date("2026-07-17T00:00:00.000Z"),
    grants: [
      {
        facilityId: STORE_A,
        facilityType: WarehouseType.STORE,
        permissions: { "revenue.read": true },
        sources: [source],
      },
      {
        facilityId: MAIN_A,
        facilityType: WarehouseType.MAIN,
        permissions: { "revenue.read": true },
        sources: [source],
      },
    ],
  }),
);

test("authorizes online sales against the requested store", () => {
  assert.deepEqual(
    authorizeOnlineSalesReportRequest(
      { warehouseId: STORE_A, from: "2026-07-01", to: "2026-07-17" },
      authorization,
    ),
    { warehouseId: STORE_A, from: "2026-07-01", to: "2026-07-17" },
  );
});

test("rejects a missing, malformed, inaccessible, or non-store scope", () => {
  const cases = [
    { from: "2026-07-01", to: "2026-07-17" },
    { warehouseId: "not-a-uuid", from: "2026-07-01", to: "2026-07-17" },
    { warehouseId: STORE_B, from: "2026-07-01", to: "2026-07-17" },
    { warehouseId: MAIN_A, from: "2026-07-01", to: "2026-07-17" },
  ];

  cases.forEach((query) => {
    assert.throws(() =>
      authorizeOnlineSalesReportRequest(query, authorization),
    );
  });
});
