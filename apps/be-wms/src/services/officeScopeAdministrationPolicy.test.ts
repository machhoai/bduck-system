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
import {
  assertCanAdministerOfficeScope,
  assertExpectedOfficeScopeRevision,
  assertOfficeScopeWithinCeiling,
  createInitialOfficeScopeConfig,
} from "./officeScopeAdministrationPolicy.js";
import { officeScopeMutationSchema } from "../utils/facilityAccessSchemas.js";

const source = {
  role_id: "role-office-admin",
  assignment_id: "assignment-office-admin",
  office_id: null,
};

const createAuthorization = (isSystemAdmin: boolean) =>
  new AuthorizationService(
    createAccessContext({
      actorId: isSystemAdmin ? "system-admin" : "office-manager",
      workplaceFacilityId: isSystemAdmin ? null : "office-a",
      isSystemAdmin,
      systemAdminSources: isSystemAdmin
        ? [{ ...source, type: "SYSTEM_GLOBAL" }]
        : [],
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date("2026-07-17T00:00:00.000Z"),
      grants: [
        {
          facilityId: "office-a",
          facilityType: WarehouseType.OFFICE,
          permissions: {
            "office_scopes.read": true,
            "office_scopes.write": true,
            ...(isSystemAdmin ? { "*": true } : {}),
          },
          sources: [
            {
              ...source,
              type: isSystemAdmin ? "SYSTEM_GLOBAL" : "DIRECT",
            },
          ],
        },
        ...(!isSystemAdmin
          ? [
              {
                facilityId: "warehouse-e",
                facilityType: WarehouseType.MAIN,
                permissions: { "office_scopes.write": true },
                sources: [
                  {
                    ...source,
                    assignment_id: "direct-warehouse-e",
                    type: "DIRECT" as const,
                  },
                ],
              },
            ]
          : []),
      ],
    }),
  );

test("allows system admin and an own-office manager with write permission", () => {
  assert.doesNotThrow(() =>
    assertCanAdministerOfficeScope(createAuthorization(true), "office-b"),
  );
  assert.doesNotThrow(() =>
    assertCanAdministerOfficeScope(createAuthorization(false), "office-a"),
  );
  assert.throws(
    () =>
      assertCanAdministerOfficeScope(createAuthorization(false), "office-b"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "AUTHORIZATION_DENIED",
  );
});

test("enforces the stable ceiling and never derives it from direct grants", () => {
  const authorization = createAuthorization(false);
  assert.doesNotThrow(() =>
    assertOfficeScopeWithinCeiling({
      authorization,
      officeId: "office-a",
      nextMode: "SELECTED",
      nextFacilityIds: ["warehouse-c", "store-d"],
      ceilingMode: "SELECTED",
      ceilingFacilityIds: ["warehouse-c", "store-d"],
    }),
  );
  assert.throws(() =>
    assertOfficeScopeWithinCeiling({
      authorization,
      officeId: "office-a",
      nextMode: "SELECTED",
      nextFacilityIds: ["warehouse-c", "warehouse-e"],
      ceilingMode: "SELECTED",
      ceilingFacilityIds: ["warehouse-c", "store-d"],
    }),
  );
});

test("allows ALL only under an ALL ceiling for delegated managers", () => {
  const authorization = createAuthorization(false);
  assert.throws(() =>
    assertOfficeScopeWithinCeiling({
      authorization,
      officeId: "office-a",
      nextMode: "ALL",
      nextFacilityIds: [],
      ceilingMode: "SELECTED",
      ceilingFacilityIds: ["warehouse-c"],
    }),
  );
  assert.doesNotThrow(() =>
    assertOfficeScopeWithinCeiling({
      authorization,
      officeId: "office-a",
      nextMode: "ALL",
      nextFacilityIds: [],
      ceilingMode: "ALL",
      ceilingFacilityIds: [],
    }),
  );
});

test("an unconfigured ceiling fails closed for delegated expansion", () => {
  assert.throws(() =>
    assertOfficeScopeWithinCeiling({
      authorization: createAuthorization(false),
      officeId: "office-a",
      nextMode: "SELECTED",
      nextFacilityIds: ["store-d"],
      ceilingMode: null,
      ceilingFacilityIds: [],
    }),
  );
});

test("creates an explicit fail-closed scope for a new office", () => {
  const actionTime = new Date("2026-07-17T01:00:00.000Z");
  const syncTime = new Date("2026-07-17T01:00:01.000Z");
  const config = createInitialOfficeScopeConfig({
    officeId: "office-a",
    actorId: "system-admin",
    actionTime,
    syncTime,
  });

  assert.equal(config.scope_mode, "SELECTED");
  assert.equal(config.revision, 1);
  assert.equal(config.is_active, true);
  assert.equal(config.is_deleted, false);
  assert.equal(config.policy_version, FACILITY_ACCESS_POLICY_VERSION);
  assert.equal(config.valid_from, null);
  assert.equal(config.valid_until, null);
  assert.equal(config.action_time, actionTime);
  assert.equal(config.sync_time, syncTime);
});

test("accepts only the exact persisted Office scope revision", () => {
  assert.doesNotThrow(() => assertExpectedOfficeScopeRevision(3, 3));
  assert.throws(
    () => assertExpectedOfficeScopeRevision(2, 3),
    (error: unknown) =>
      error instanceof Error &&
      "statusCode" in error &&
      error.statusCode === 409 &&
      "code" in error &&
      error.code === "OFFICE_SCOPE_REVISION_CONFLICT",
  );
  assert.throws(() => assertExpectedOfficeScopeRevision(0, undefined));
});

test("requires a nonnegative expected revision in every scope mutation", () => {
  assert.equal(
    officeScopeMutationSchema.parse({
      scope_mode: "SELECTED",
      target_facility_ids: ["store-d"],
      expected_revision: 2,
    }).expected_revision,
    2,
  );
  assert.throws(() =>
    officeScopeMutationSchema.parse({
      scope_mode: "SELECTED",
      target_facility_ids: [],
    }),
  );
  assert.throws(() =>
    officeScopeMutationSchema.parse({
      scope_mode: "ALL",
      target_facility_ids: [],
      expected_revision: -1,
    }),
  );
});
