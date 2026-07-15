import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ActiveStatus, WarehouseType } from "@bduck/shared-types";
import { buildAccessContext } from "./accessContextBuilder.js";
import { AuthorizationService } from "./authorizationService.js";
import {
  TEST_NOW,
  createActor,
  createAssignment,
  createConfig,
  createEdge,
  createFacility,
  createRole,
  createSnapshot,
} from "./authorizationTestFixtures.js";

const inventoryRead = createRole("office-reader", {
  "inventory.read": true,
});

describe("office access scope", () => {
  it("resolves ALL dynamically and ignores future configs or inactive facilities", () => {
    const facilities = [
      createFacility("office-a", WarehouseType.OFFICE),
      createFacility("office-b", WarehouseType.OFFICE),
      createFacility("main-old", WarehouseType.MAIN),
      createFacility("store-added-later", WarehouseType.STORE),
      createFacility("store-inactive", WarehouseType.STORE, {
        status: ActiveStatus.INACTIVE,
      }),
    ];
    const base = createSnapshot({
      facilities,
      roles: [inventoryRead],
      assignments: [
        createAssignment("office-role", "office-a", inventoryRead.id, {
          valid_until: "2026-07-15",
        }),
      ],
      officeScopeConfigs: [createConfig("office-a", "ALL")],
    });

    const service = new AuthorizationService(buildAccessContext(base));
    assert.deepEqual(service.facilityIdsFor("inventory.read"), [
      "main-old",
      "store-added-later",
    ]);
    assert.equal(service.can("inventory.read", "office-b"), false);

    const futureConfig = buildAccessContext({
      ...base,
      officeScopeConfigs: [
        createConfig("office-a", "ALL", {
          valid_from: new Date("2026-07-16T00:00:00.000Z"),
        }),
      ],
    });
    assert.deepEqual(
      new AuthorizationService(futureConfig).facilityIdsFor("inventory.read"),
      [],
    );
  });

  it("resolves only active SELECTED MAIN/STORE edges without office chaining", () => {
    const context = buildAccessContext(
      createSnapshot({
        facilities: [
          createFacility("office-a", WarehouseType.OFFICE),
          createFacility("office-b", WarehouseType.OFFICE),
          createFacility("store-d", WarehouseType.STORE),
          createFacility("main-c", WarehouseType.MAIN),
        ],
        roles: [inventoryRead],
        assignments: [
          createAssignment("office-role", "office-a", inventoryRead.id),
        ],
        officeScopeConfigs: [
          createConfig("office-a", "SELECTED"),
          createConfig("office-b", "ALL"),
        ],
        officeScopeEdges: [
          createEdge("office-a", "store-d"),
          createEdge("office-a", "main-c", {
            valid_from: new Date("2026-07-16T00:00:00.000Z"),
          }),
          createEdge("office-a", "office-b"),
          createEdge("office-b", "main-c"),
        ],
      }),
    );
    const service = new AuthorizationService(context);

    assert.equal(service.can("inventory.read", "store-d"), true);
    assert.equal(service.can("inventory.read", "main-c"), false);
    assert.equal(service.can("inventory.read", "office-b"), false);
  });

  it("fails closed for an unknown persisted scope mode", () => {
    const context = buildAccessContext(
      createSnapshot({
        facilities: [
          createFacility("office-a", WarehouseType.OFFICE),
          createFacility("store-d", WarehouseType.STORE),
        ],
        roles: [inventoryRead],
        assignments: [
          createAssignment("office-role", "office-a", inventoryRead.id),
        ],
        officeScopeConfigs: [
          {
            ...createConfig("office-a", "SELECTED"),
            scope_mode: "BAD" as never,
          },
        ],
        officeScopeEdges: [createEdge("office-a", "store-d")],
      }),
    );

    assert.equal(
      new AuthorizationService(context).can("inventory.read", "store-d"),
      false,
    );
  });

  it("fails closed when required config or edge soft-delete flags are missing", () => {
    const base = createSnapshot({
      facilities: [
        createFacility("office-a", WarehouseType.OFFICE),
        createFacility("store-d", WarehouseType.STORE),
      ],
      roles: [inventoryRead],
      assignments: [
        createAssignment("office-role", "office-a", inventoryRead.id),
      ],
      officeScopeEdges: [createEdge("office-a", "store-d")],
    });
    const missingConfigFlag = buildAccessContext({
      ...base,
      officeScopeConfigs: [
        createConfig("office-a", "SELECTED", {
          is_deleted: undefined as never,
        }),
      ],
    });
    assert.equal(
      new AuthorizationService(missingConfigFlag).can(
        "inventory.read",
        "store-d",
      ),
      false,
    );

    const missingEdgeFlag = buildAccessContext({
      ...base,
      officeScopeConfigs: [createConfig("office-a", "SELECTED")],
      officeScopeEdges: [
        createEdge("office-a", "store-d", {
          is_deleted: undefined as never,
        }),
      ],
    });
    assert.equal(
      new AuthorizationService(missingEdgeFlag).can(
        "inventory.read",
        "store-d",
      ),
      false,
    );
  });

  it("uses only the actor's current office after a workplace move", () => {
    const context = buildAccessContext(
      createSnapshot({
        actor: createActor({ workplace_facility_id: "office-b" }),
        facilities: [
          createFacility("office-a", WarehouseType.OFFICE),
          createFacility("office-b", WarehouseType.OFFICE),
          createFacility("store-a", WarehouseType.STORE),
          createFacility("store-b", WarehouseType.STORE),
        ],
        roles: [inventoryRead],
        assignments: [
          createAssignment("old-office-role", "office-a", inventoryRead.id),
          createAssignment("new-office-role", "office-b", inventoryRead.id),
        ],
        officeScopeConfigs: [
          createConfig("office-a", "SELECTED"),
          createConfig("office-b", "SELECTED"),
        ],
        officeScopeEdges: [
          createEdge("office-a", "store-a"),
          createEdge("office-b", "store-b"),
        ],
      }),
    );
    const service = new AuthorizationService(context);

    assert.equal(service.can("inventory.read", "store-a"), false);
    assert.equal(service.can("inventory.read", "store-b"), true);
    assert.equal(service.can("inventory.read", "office-a"), false);
  });

  it("merges direct and inherited permissions with auditable sources", () => {
    const directWriter = createRole("direct-writer", {
      "inventory.write": true,
    });
    const context = buildAccessContext(
      createSnapshot({
        facilities: [
          createFacility("office-a", WarehouseType.OFFICE),
          createFacility("store-d", WarehouseType.STORE),
        ],
        roles: [inventoryRead, directWriter],
        assignments: [
          createAssignment("office-role", "office-a", inventoryRead.id),
          createAssignment("direct-store", "store-d", directWriter.id),
        ],
        officeScopeConfigs: [createConfig("office-a", "SELECTED")],
        officeScopeEdges: [createEdge("office-a", "store-d")],
      }),
    );

    assert.deepEqual(context.grants["store-d"]?.permissions, {
      "inventory.read": true,
      "inventory.write": true,
    });
    assert.deepEqual(
      context.grants["store-d"]?.sources.map((source) => source.type).sort(),
      ["DIRECT", "OFFICE_INHERITED"],
    );
    assert.equal(context.computedAt, TEST_NOW.toISOString());
  });

  it("keeps legacy office assignments direct without inferring managed scope", () => {
    const context = buildAccessContext(
      createSnapshot({
        facilities: [
          createFacility("office-a", WarehouseType.OFFICE),
          createFacility("store-d", WarehouseType.STORE),
        ],
        roles: [inventoryRead],
        assignments: [
          createAssignment("legacy-office", "office-a", inventoryRead.id, {
            scope_origin: "LEGACY_DIRECT",
          }),
        ],
        officeScopeConfigs: [createConfig("office-a", "ALL")],
      }),
    );
    const service = new AuthorizationService(context);

    assert.equal(service.can("inventory.read", "office-a"), false);
    assert.equal(service.can("inventory.read", "store-d"), false);
    assert.equal(context.grants["office-a"]?.sources[0]?.type, "LEGACY_DIRECT");
  });
});
