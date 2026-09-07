import assert from "node:assert/strict";
import test from "node:test";

import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
} from "@bduck/shared-types";

import { createAccessContext } from "./authorization/accessContextFactory.js";
import { AuthorizationService } from "./authorization/authorizationService.js";
import type { AccessContextGrantSeed } from "./authorization/authorizationTypes.js";
import { getAuthorizedRevenueWarehouseIds } from "./revenueWarehouseScope.js";

function authorization(secondStoreExport = true) {
  return new AuthorizationService(
    createAccessContext({
      actorId: "user",
      workplaceFacilityId: "a",
      isSystemAdmin: false,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date(),
      grants: ([
        {
          facilityId: "a",
          facilityType: WarehouseType.STORE,
          permissions: { "revenue.read": true, "revenue.export": true },
        },
        {
          facilityId: "b",
          facilityType: WarehouseType.STORE,
          permissions: {
            "revenue.read": true,
            "revenue.export": secondStoreExport,
          },
        },
        {
          facilityId: "unrelated",
          facilityType: WarehouseType.STORE,
          permissions: { "inventory.read": true },
        },
        {
          facilityId: "office",
          facilityType: WarehouseType.OFFICE,
          permissions: { "*": true },
        },
      ] as Array<Omit<AccessContextGrantSeed, "sources">>).map((grant) => ({
        ...grant,
        sources: [
          {
            type: "DIRECT" as const,
            role_id: "role",
            assignment_id: grant.facilityId,
            office_id: null,
          },
        ],
      })),
    }),
  );
}

test("ALL includes only readable stores and excludes inventory-only and office grants", () => {
  assert.deepEqual(
    getAuthorizedRevenueWarehouseIds(
      authorization(),
      "LOCAL_POS",
      "ALL",
      "revenue.read",
    ),
    ["a", "b"],
  );
  assert.deepEqual(
    getAuthorizedRevenueWarehouseIds(
      authorization(),
      "LOCAL_POS",
      "ALL",
      "revenue.export",
    ),
    ["a", "b"],
  );
});

test("ALL export fails if any visible store cannot be exported; no silent partial totals", () => {
  assert.throws(() =>
    getAuthorizedRevenueWarehouseIds(
      authorization(false),
      "LOCAL_POS",
      "ALL",
      "revenue.export",
    ),
  );
  assert.deepEqual(
    getAuthorizedRevenueWarehouseIds(
      authorization(false),
      "LOCAL_POS",
      "a",
      "revenue.export",
    ),
    ["a"],
  );
});

test("rejects unknown stores and ALL for OpenAPI", () => {
  assert.throws(() =>
    getAuthorizedRevenueWarehouseIds(
      authorization(),
      "LOCAL_POS",
      "unknown",
      "revenue.read",
    ),
  );
  assert.throws(() =>
    getAuthorizedRevenueWarehouseIds(
      authorization(),
      "OPEN_API",
      "ALL",
      "revenue.read",
    ),
  );
});

test("ALL fails closed when there are no readable stores", () => {
  const access = new AuthorizationService(
    createAccessContext({
      actorId: "user",
      workplaceFacilityId: "a",
      isSystemAdmin: false,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date(),
      grants: [],
    }),
  );
  assert.throws(() =>
    getAuthorizedRevenueWarehouseIds(
      access,
      "LOCAL_POS",
      "ALL",
      "revenue.read",
    ),
  );
});
