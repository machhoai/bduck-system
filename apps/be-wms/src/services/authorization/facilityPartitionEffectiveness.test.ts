import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UserStatus, WarehouseType } from "@bduck/shared-types";
import { buildAccessContext } from "./accessContextBuilder.js";
import { AuthorizationError } from "./authorizationError.js";
import { AuthorizationService } from "./authorizationService.js";
import {
  createActor,
  createAssignment,
  createConfig,
  createEdge,
  createFacility,
  createRole,
  createSnapshot,
} from "./authorizationTestFixtures.js";

const facilities = [
  createFacility("office-a", WarehouseType.OFFICE),
  createFacility("office-b", WarehouseType.OFFICE),
  createFacility("office-future", WarehouseType.OFFICE),
  createFacility("warehouse-c", WarehouseType.MAIN),
  createFacility("store-d", WarehouseType.STORE),
  createFacility("warehouse-e", WarehouseType.MAIN),
  createFacility("store-f", WarehouseType.STORE),
  createFacility("future-store", WarehouseType.STORE),
];

const managerRole = createRole("facility-manager", {
  "warehouses.read": true,
  "employees.read": true,
  "users.read": true,
  "inventory.read": true,
  "inventory.write": true,
  "revenue.read": true,
  "transfers.read": true,
  "transfers.write": true,
  "transfers.receive": true,
});

const inventoryViewerRole = createRole("inventory-viewer", {
  "inventory.read": true,
});

const serviceForOffice = (
  officeId: "office-a" | "office-b",
  scopeMode: "ALL" | "SELECTED",
  targets: string[] = [],
  role = managerRole,
): AuthorizationService =>
  new AuthorizationService(
    buildAccessContext(
      createSnapshot({
        actor: createActor({ workplace_facility_id: officeId }),
        facilities,
        roles: [role],
        assignments: [createAssignment("office-role", officeId, role.id)],
        officeScopeConfigs: [createConfig(officeId, scopeMode)],
        officeScopeEdges: targets.map((target) => createEdge(officeId, target)),
      }),
    ),
  );

describe("facility partition effectiveness", () => {
  it("keeps Office A ALL dynamic for warehouses/stores and excludes offices", () => {
    const service = serviceForOffice("office-a", "ALL");

    assert.deepEqual(service.facilityIdsFor("inventory.read"), [
      "future-store",
      "store-d",
      "store-f",
      "warehouse-c",
      "warehouse-e",
    ]);
    assert.equal(service.can("warehouses.read", "office-a"), true);
    assert.equal(service.can("warehouses.read", "office-b"), false);
    assert.equal(service.can("warehouses.read", "office-future"), false);
  });

  it("limits Office B SELECTED to Warehouse C and Store D", () => {
    const service = serviceForOffice("office-b", "SELECTED", [
      "warehouse-c",
      "store-d",
    ]);

    assert.equal(service.can("inventory.read", "warehouse-c"), true);
    assert.equal(service.can("inventory.read", "store-d"), true);
    assert.equal(service.can("inventory.read", "warehouse-e"), false);
    assert.equal(service.can("inventory.read", "store-f"), false);
    assert.equal(service.can("employees.read", "office-a"), false);
    assert.deepEqual(
      service.context.grants["store-d"]?.sources.map((source) => source.type),
      ["OFFICE_INHERITED"],
    );
  });

  it("requires both action permission and facility scope", () => {
    const viewer = serviceForOffice(
      "office-b",
      "SELECTED",
      ["warehouse-c", "store-d"],
      inventoryViewerRole,
    );

    assert.equal(viewer.can("inventory.read", "warehouse-c"), true);
    assert.equal(viewer.can("inventory.write", "warehouse-c"), false);
    assert.equal(viewer.can("inventory.read", "warehouse-e"), false);
    assert.equal(viewer.can("revenue.read", "store-d"), false);
  });

  it("keeps warehouse/store staff self-scoped", () => {
    const staffContext = buildAccessContext(
      createSnapshot({
        actor: createActor({ workplace_facility_id: "warehouse-c" }),
        facilities,
        roles: [inventoryViewerRole],
        assignments: [
          createAssignment(
            "warehouse-role",
            "warehouse-c",
            inventoryViewerRole.id,
          ),
        ],
      }),
    );
    const staff = new AuthorizationService(staffContext);

    assert.equal(staff.can("inventory.read", "warehouse-c"), true);
    assert.equal(staff.can("inventory.read", "store-d"), false);
    assert.equal(staff.can("inventory.read", "office-b"), false);
  });

  it("revokes inherited scope and uses only the current office after a move", () => {
    const revoked = serviceForOffice("office-b", "SELECTED", ["warehouse-c"]);
    assert.equal(revoked.can("inventory.read", "store-d"), false);

    const moved = new AuthorizationService(
      buildAccessContext(
        createSnapshot({
          actor: createActor({ workplace_facility_id: "office-a" }),
          facilities,
          roles: [managerRole],
          assignments: [
            createAssignment("old-office-role", "office-b", managerRole.id),
            createAssignment("new-office-role", "office-a", managerRole.id),
          ],
          officeScopeConfigs: [
            createConfig("office-a", "SELECTED"),
            createConfig("office-b", "SELECTED"),
          ],
          officeScopeEdges: [
            createEdge("office-a", "warehouse-e"),
            createEdge("office-b", "warehouse-c"),
          ],
        }),
      ),
    );
    assert.equal(moved.can("inventory.read", "warehouse-e"), true);
    assert.equal(moved.can("inventory.read", "warehouse-c"), false);

    assert.throws(
      () =>
        buildAccessContext(
          createSnapshot({
            actor: createActor({ status: UserStatus.INACTIVE }),
            facilities,
          }),
        ),
      AuthorizationError,
    );
  });

  it("enforces transfer source/destination responsibilities", () => {
    const manager = serviceForOffice("office-b", "SELECTED", [
      "warehouse-c",
      "store-d",
    ]);

    assert.equal(manager.canReadTransfer("warehouse-c", "warehouse-e"), true);
    assert.equal(manager.canReadTransfer("warehouse-e", "store-d"), true);
    assert.equal(manager.canReadTransfer("warehouse-e", "store-f"), false);
    assert.equal(manager.canWriteTransfer("warehouse-c"), true);
    assert.equal(manager.canWriteTransfer("warehouse-e"), false);
    assert.equal(manager.canReceiveTransfer("store-d"), true);
    assert.equal(manager.canReceiveTransfer("store-f"), false);
  });

  it("reserves global visibility for an exact system-admin assignment", () => {
    const adminRole = createRole("system-admin", { "*": true });
    const admin = new AuthorizationService(
      buildAccessContext(
        createSnapshot({
          actor: createActor({ workplace_facility_id: null }),
          facilities,
          roles: [adminRole],
          assignments: [createAssignment("global-admin", null, adminRole.id)],
        }),
      ),
    );

    assert.equal(admin.context.isSystemAdmin, true);
    assert.equal(admin.can("warehouses.read", "office-future"), true);
    assert.equal(admin.can("inventory.read", "warehouse-e"), true);
    assert.equal(admin.can("revenue.read", "warehouse-e"), false);
    assert.equal(admin.can("revenue.read", "store-f"), true);
  });
});
