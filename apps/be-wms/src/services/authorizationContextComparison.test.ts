import assert from "node:assert/strict";
import test from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
} from "@bduck/shared-types";
import { createAccessContext } from "./authorization/index.js";
import { compareAccessContexts } from "./authorizationContextComparison.js";

const source = {
  type: "DIRECT" as const,
  role_id: "role-stock",
  assignment_id: "assignment-a",
  office_id: null,
};

const createContext = (
  permissions: Record<string, boolean>,
  computedAt: Date,
) =>
  createAccessContext({
    actorId: "user-a",
    workplaceFacilityId: "office-a",
    isSystemAdmin: false,
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt,
    grants: [
      {
        facilityId: "warehouse-c",
        facilityType: WarehouseType.MAIN,
        permissions,
        sources: [source],
      },
    ],
  });

test("comparison ignores computed time and collection ordering", () => {
  const live = createContext(
    { "inventory.read": true, "inventory.update": true },
    new Date("2026-01-01"),
  );
  const materialized = createContext(
    { "inventory.update": true, "inventory.read": true },
    new Date("2026-02-01"),
  );
  assert.deepEqual(
    compareAccessContexts(live, materialized).differingFields,
    [],
  );
});

test("comparison reports changed effective grants", () => {
  const live = createContext(
    { "inventory.read": true },
    new Date("2026-01-01"),
  );
  const materialized = createContext(
    { "inventory.update": true },
    new Date("2026-01-01"),
  );
  const result = compareAccessContexts(live, materialized);
  assert.equal(result.matches, false);
  assert.deepEqual(result.differingFields, ["grant_fingerprint"]);
});
