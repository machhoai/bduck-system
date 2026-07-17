import assert from "node:assert/strict";
import test from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type AuthorizationRolloutMode,
} from "@bduck/shared-types";
import { createAccessContext } from "./authorization/index.js";
import {
  getAuthorizationRolloutMode,
  resolveAuthorizationContext,
  type AuthorizationRolloutDependencies,
} from "./authorizationRolloutService.js";

const createContext = (permission = "inventory.read") =>
  createAccessContext({
    actorId: "user-a",
    workplaceFacilityId: "office-a",
    isSystemAdmin: false,
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt: new Date("2026-07-16T00:00:00.000Z"),
    grants: [
      {
        facilityId: "warehouse-c",
        facilityType: WarehouseType.MAIN,
        permissions: { [permission]: true },
        sources: [
          {
            type: "DIRECT",
            role_id: "role-a",
            assignment_id: "assignment-a",
            office_id: null,
          },
        ],
      },
    ],
  });

const dependencies = (
  loadMaterialized: AuthorizationRolloutDependencies["loadMaterialized"],
  observations: Parameters<
    AuthorizationRolloutDependencies["recordObservation"]
  >[0][],
): AuthorizationRolloutDependencies => ({
  loadMaterialized,
  recordObservation: async (observation) => {
    observations.push(observation);
  },
});

test("rollout mode defaults to materialized and rejects invalid values", () => {
  assert.equal(getAuthorizationRolloutMode(undefined), "MATERIALIZED");
  assert.equal(getAuthorizationRolloutMode(" shadow "), "SHADOW");
  assert.throws(() => getAuthorizationRolloutMode("legacy"));
});

test("shadow serves live context and records mismatches", async () => {
  const live = createContext("inventory.read");
  const observations: Parameters<
    AuthorizationRolloutDependencies["recordObservation"]
  >[0][] = [];
  const resolved = await resolveAuthorizationContext(
    "user-a",
    live,
    "SHADOW",
    dependencies(async () => createContext("inventory.update"), observations),
  );
  assert.equal(resolved, live);
  assert.equal(observations[0]?.outcome, "MISMATCH");
});

test("shadow does not block requests when materialized reads fail", async () => {
  const live = createContext();
  const observations: Parameters<
    AuthorizationRolloutDependencies["recordObservation"]
  >[0][] = [];
  const resolved = await resolveAuthorizationContext(
    "user-a",
    live,
    "SHADOW",
    dependencies(async () => {
      throw new Error("BROKEN_SNAPSHOT");
    }, observations),
  );
  assert.equal(resolved, live);
  assert.equal(observations[0]?.outcome, "MATERIALIZED_INVALID");
});

test("materialized mode serves only materialized context and fails closed", async () => {
  const materialized = createContext();
  const observations: Parameters<
    AuthorizationRolloutDependencies["recordObservation"]
  >[0][] = [];
  assert.equal(
    await resolveAuthorizationContext(
      "user-a",
      null,
      "MATERIALIZED" satisfies AuthorizationRolloutMode,
      dependencies(async () => materialized, observations),
    ),
    materialized,
  );
  await assert.rejects(() =>
    resolveAuthorizationContext(
      "user-a",
      createContext(),
      "MATERIALIZED",
      dependencies(async () => null, observations),
    ),
  );
});
