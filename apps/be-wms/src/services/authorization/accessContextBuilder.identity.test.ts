import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ActiveStatus, UserStatus, WarehouseType } from "@bduck/shared-types";
import { buildAccessContext } from "./accessContextBuilder.js";
import { AuthorizationService } from "./authorizationService.js";
import {
  createActor,
  createAssignment,
  createFacility,
  createRole,
  createSnapshot,
  expectAuthorizationCode,
} from "./authorizationTestFixtures.js";

describe("actor and direct facility grants", () => {
  it("fails closed for a missing/inactive actor or invalid workplace", () => {
    expectAuthorizationCode(
      () => buildAccessContext(createSnapshot({ actor: null })),
      "AUTHORIZATION_ACTOR_REQUIRED",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            actor: createActor({ status: UserStatus.SUSPENDED }),
          }),
        ),
      "AUTHORIZATION_ACTOR_INACTIVE",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            actor: createActor({ workplace_facility_id: null }),
          }),
        ),
      "AUTHORIZATION_WORKPLACE_REQUIRED",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            actor: createActor({ workplace_facility_id: "unknown" }),
          }),
        ),
      "AUTHORIZATION_WORKPLACE_INVALID",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            facilities: [createFacility("office-a", "CORRUPT" as never)],
          }),
        ),
      "AUTHORIZATION_WORKPLACE_INVALID",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            facilities: [
              createFacility("office-a", WarehouseType.OFFICE, {
                is_active: "true" as never,
              }),
            ],
          }),
        ),
      "AUTHORIZATION_WORKPLACE_INVALID",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            actor: createActor({ is_deleted: undefined as never }),
          }),
        ),
      "AUTHORIZATION_ACTOR_INACTIVE",
    );
    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            facilities: [
              createFacility("office-a", WarehouseType.OFFICE, {
                is_deleted: undefined as never,
              }),
            ],
          }),
        ),
      "AUTHORIZATION_WORKPLACE_INVALID",
    );
  });

  it("keeps MAIN/STORE staff self-scoped while honoring explicit direct grants", () => {
    const reader = createRole("reader", { "inventory.read": true });
    const futureRole = createRole(
      "future-role",
      { "inventory.read": true },
      { valid_from: "2026-07-16" },
    );
    const context = buildAccessContext(
      createSnapshot({
        actor: createActor({ workplace_facility_id: "main-a" }),
        facilities: [
          createFacility("main-a", WarehouseType.MAIN),
          createFacility("store-d", WarehouseType.STORE),
          createFacility("main-b", WarehouseType.MAIN),
          createFacility("future-store", WarehouseType.STORE, {
            valid_from: "2026-07-16",
          }),
        ],
        roles: [reader, futureRole],
        assignments: [
          createAssignment("self", "main-a", reader.id),
          createAssignment("explicit", "store-d", reader.id),
          createAssignment("other-user", "main-b", reader.id, {
            user_id: "user-2",
          }),
          createAssignment("future-assignment", "main-b", reader.id, {
            valid_from: "2026-07-16",
          }),
          createAssignment("future-role-grant", "main-b", futureRole.id),
          createAssignment("future-facility", "future-store", reader.id),
        ],
      }),
    );

    assert.deepEqual(
      new AuthorizationService(context).facilityIdsFor("inventory.read"),
      ["main-a", "store-d"],
    );
  });

  it("derives system admin only from an active null-scope wildcard role", () => {
    const namedAdmin = createRole(
      "named-admin",
      { "inventory.read": true },
      { name: "ADMIN" },
    );
    const wildcard = createRole(
      "wildcard",
      { "*": true },
      { name: "Ordinary custom role" },
    );
    const base = createSnapshot({
      actor: createActor({ workplace_facility_id: "main-a" }),
      facilities: [
        createFacility("main-a", WarehouseType.MAIN),
        createFacility("store-d", WarehouseType.STORE),
        createFacility("office-a", WarehouseType.OFFICE),
      ],
      roles: [namedAdmin, wildcard],
      assignments: [createAssignment("named-global", null, namedAdmin.id)],
    });
    const namedOnly = buildAccessContext(base);
    assert.equal(namedOnly.isSystemAdmin, false);
    assert.deepEqual(Object.keys(namedOnly.grants), []);

    expectAuthorizationCode(
      () =>
        buildAccessContext({
          ...base,
          actor: createActor({ workplace_facility_id: null }),
        }),
      "AUTHORIZATION_WORKPLACE_REQUIRED",
    );

    const emptyScopeIsNotGlobal = buildAccessContext({
      ...base,
      assignments: [createAssignment("empty", "", wildcard.id)],
    });
    assert.equal(emptyScopeIsNotGlobal.isSystemAdmin, false);

    const admin = buildAccessContext({
      ...base,
      assignments: [createAssignment("wildcard-global", null, wildcard.id)],
    });
    assert.equal(admin.isSystemAdmin, true);
    assert.deepEqual(
      new AuthorizationService(admin).facilityIdsFor("inventory.write"),
      ["main-a", "store-d"],
    );

    const workplaceFreeAdmin = buildAccessContext({
      ...base,
      actor: createActor({ workplace_facility_id: null }),
      assignments: [createAssignment("wildcard-global", null, wildcard.id)],
    });
    assert.equal(workplaceFreeAdmin.workplaceFacilityId, null);
    assert.equal(workplaceFreeAdmin.isSystemAdmin, true);

    const staleWorkplaceAdmin = buildAccessContext({
      ...base,
      actor: createActor({ workplace_facility_id: "deleted-workplace" }),
      assignments: [createAssignment("wildcard-global", null, wildcard.id)],
    });
    assert.equal(staleWorkplaceAdmin.workplaceFacilityId, null);
    assert.equal(staleWorkplaceAdmin.isSystemAdmin, true);
  });

  it("ignores deleted or inactive roles and workplaces", () => {
    const inactiveRole = createRole(
      "inactive",
      { "inventory.read": true },
      { status: ActiveStatus.INACTIVE },
    );
    const corruptActiveRole = createRole(
      "corrupt-active",
      { "inventory.read": true },
      { is_active: "true" as never },
    );
    const context = buildAccessContext(
      createSnapshot({
        roles: [inactiveRole, corruptActiveRole],
        assignments: [
          createAssignment("inactive-role", "office-a", inactiveRole.id),
          createAssignment("corrupt-active", "office-a", corruptActiveRole.id),
        ],
      }),
    );
    assert.deepEqual(Object.keys(context.grants), []);

    const missingDeleteFlag = buildAccessContext(
      createSnapshot({
        roles: [
          createRole(
            "missing-flag",
            { "inventory.read": true },
            {
              is_deleted: undefined as never,
            },
          ),
        ],
        assignments: [
          createAssignment("missing-flag", "office-a", "missing-flag"),
        ],
      }),
    );
    assert.deepEqual(Object.keys(missingDeleteFlag.grants), []);

    expectAuthorizationCode(
      () =>
        buildAccessContext(
          createSnapshot({
            facilities: [
              createFacility("office-a", WarehouseType.OFFICE, {
                status: ActiveStatus.INACTIVE,
              }),
            ],
          }),
        ),
      "AUTHORIZATION_WORKPLACE_INVALID",
    );
  });
});
