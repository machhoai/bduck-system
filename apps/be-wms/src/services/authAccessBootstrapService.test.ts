import assert from "node:assert/strict";
import test from "node:test";
import { FACILITY_ACCESS_POLICY_VERSION } from "@bduck/shared-types";
import {
  createAccessContext,
  type AccessContext,
} from "./authorization/index.js";
import {
  ensureSessionUserAccessWithDependencies,
  type AuthAccessBootstrapDependencies,
} from "./authAccessBootstrapService.js";

const adminContext = (): AccessContext =>
  createAccessContext({
    actorId: "admin-a",
    workplaceFacilityId: null,
    isSystemAdmin: true,
    systemAdminSources: [
      {
        type: "SYSTEM_GLOBAL",
        role_id: "role-admin",
        assignment_id: "assignment-admin",
        office_id: null,
      },
    ],
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt: new Date("2026-07-17T00:00:00.000Z"),
    grants: [],
  });

test("uses an existing materialized context without rebuilding", async () => {
  const events: string[] = [];
  const context = adminContext();
  const dependencies: AuthAccessBootstrapDependencies = {
    loadAccessContext: async () => {
      events.push("load");
      return context;
    },
    materializeAccess: async () => {
      events.push("materialize");
    },
  };

  assert.equal(
    await ensureSessionUserAccessWithDependencies("admin-a", dependencies),
    context,
  );
  assert.deepEqual(events, ["load"]);
});

test("rebuilds once when the snapshot is missing or invalid", async () => {
  const events: string[] = [];
  const context = adminContext();
  let loadCount = 0;
  const dependencies: AuthAccessBootstrapDependencies = {
    loadAccessContext: async () => {
      events.push("load");
      loadCount += 1;
      if (loadCount === 1) throw new Error("INVALID_SNAPSHOT");
      return context;
    },
    materializeAccess: async (userId, computedBy) => {
      events.push(`materialize:${userId}:${computedBy}`);
    },
  };

  assert.equal(
    await ensureSessionUserAccessWithDependencies("admin-a", dependencies),
    context,
  );
  assert.deepEqual(events, [
    "load",
    "materialize:admin-a:admin-a",
    "load",
  ]);
});

test("fails closed when rebuilding still produces no usable access", async () => {
  const dependencies: AuthAccessBootstrapDependencies = {
    loadAccessContext: async () => null,
    materializeAccess: async () => undefined,
  };

  await assert.rejects(
    ensureSessionUserAccessWithDependencies("admin-a", dependencies),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "AUTHORIZATION_SOURCE_INVALID",
  );
});
