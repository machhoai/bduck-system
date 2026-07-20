import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
} from "@bduck/shared-types";
import { createAccessContext } from "./accessContextFactory.js";
import { AuthorizationError } from "./authorizationError.js";
import { AuthorizationService } from "./authorizationService.js";

const directSource = (id: string) => ({
  type: "DIRECT" as const,
  role_id: `role-${id}`,
  assignment_id: `assignment-${id}`,
  office_id: null,
});

const context = createAccessContext({
  actorId: "user-1",
  workplaceFacilityId: "main-a",
  isSystemAdmin: false,
  policyVersion: FACILITY_ACCESS_POLICY_VERSION,
  computedAt: new Date("2026-07-15T00:00:00.000Z"),
  grants: [
    {
      facilityId: "source",
      facilityType: WarehouseType.MAIN,
      permissions: {
        "transfers.read": true,
        "transfers.write": true,
        "revenue.read": true,
        "invoices.read": true,
      },
      sources: [directSource("source")],
    },
    {
      facilityId: "destination",
      facilityType: WarehouseType.STORE,
      permissions: {
        "transfers.read": true,
        "transfers.receive": true,
        "revenue.read": true,
        "invoices.read": true,
      },
      sources: [directSource("destination")],
    },
    {
      facilityId: "read-only-source",
      facilityType: WarehouseType.MAIN,
      permissions: { "transfers.read": true },
      sources: [directSource("read-only-source")],
    },
    {
      facilityId: "unrelated",
      facilityType: WarehouseType.STORE,
      permissions: { "inventory.read": true },
      sources: [directSource("unrelated")],
    },
    {
      facilityId: "office",
      facilityType: WarehouseType.OFFICE,
      permissions: {
        "transfers.read": true,
        "transfers.write": true,
        "transfers.receive": true,
        "inventory.read": true,
        "inventory.write": true,
        "locations.read": true,
        "locations.write": true,
        "vouchers.read": true,
        "vouchers.write": true,
        "external_scan.view": true,
        "external_scan.manage_queue": true,
        "invoices.read": true,
      },
      sources: [directSource("office")],
    },
  ],
});

describe("AuthorizationService", () => {
  const service = new AuthorizationService(context);

  it("limits revenue actions to STORE facilities", () => {
    assert.equal(service.can("revenue.read", "source"), false);
    assert.equal(service.can("revenue.read", "destination"), true);
    assert.deepEqual(service.facilityIdsFor("revenue.read"), ["destination"]);
  });

  it("limits invoice actions to STORE facilities", () => {
    assert.equal(service.can("invoices.read", "source"), false);
    assert.equal(service.can("invoices.read", "destination"), true);
    assert.equal(service.can("invoices.read", "office"), false);
    assert.deepEqual(service.facilityIdsFor("invoices.read"), ["destination"]);
  });

  it("enforces the transfer source/destination policy table", () => {
    const readCases: Array<[string, string, boolean]> = [
      ["source", "unrelated", true],
      ["unrelated", "destination", true],
      ["source", "destination", true],
      ["unrelated", "missing", false],
    ];
    readCases.forEach(([source, destination, expected]) => {
      assert.equal(service.canReadTransfer(source, destination), expected);
    });

    assert.equal(service.canWriteTransfer("source"), true);
    assert.equal(service.canWriteTransfer("read-only-source"), false);
    assert.equal(service.canWriteTransfer("destination"), false);
    assert.equal(service.canReceiveTransfer("destination"), true);
    assert.equal(service.canReceiveTransfer("source"), false);
    assert.equal(service.canReadTransfer("office", "missing"), false);
    assert.equal(service.canWriteTransfer("office"), false);
    assert.equal(service.canReceiveTransfer("office"), false);
  });

  it("never treats an OFFICE as an inventory or storage location", () => {
    for (const action of [
      "inventory.read",
      "inventory.write",
      "locations.read",
      "locations.write",
      "vouchers.read",
      "vouchers.write",
      "stock_counts.view",
      "stock_counts.count",
      "external_count.view",
      "external_count.count",
      "external_scan.view",
      "external_scan.manage_queue",
    ]) {
      assert.equal(service.can(action, "office"), false);
    }
  });

  it("fails closed for unknown facilities and exposes bilingual errors", () => {
    assert.equal(service.can("inventory.read", "missing"), false);
    assert.throws(
      () => service.assert("inventory.read", "missing"),
      (error: unknown) => {
        assert.ok(error instanceof AuthorizationError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "AUTHORIZATION_DENIED");
        assert.ok(error.messages.vi.length > 0);
        assert.ok(error.messages.zh.length > 0);
        return true;
      },
    );
    assert.throws(
      () => service.assertCanReadTransfer("unrelated", "missing"),
      AuthorizationError,
    );
  });

  it("keeps grant inputs immutable and filters disabled permissions", () => {
    const seedPermissions = {
      "inventory.read": true,
      "inventory.write": false,
    };
    const immutable = createAccessContext({
      actorId: "user-1",
      workplaceFacilityId: "source",
      isSystemAdmin: false,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date(),
      grants: [
        {
          facilityId: "source",
          facilityType: WarehouseType.MAIN,
          permissions: seedPermissions,
          sources: [directSource("immutable")],
        },
      ],
    });

    seedPermissions["inventory.read"] = false;
    assert.equal(immutable.grants.source?.permissions["inventory.read"], true);
    assert.equal(
      immutable.grants.source?.permissions["inventory.write"],
      undefined,
    );
    assert.equal(Object.isFrozen(immutable.grants.source?.permissions), true);
  });

  it("rejects materialized permissions without valid provenance", () => {
    assert.throws(
      () =>
        createAccessContext({
          actorId: "user-1",
          workplaceFacilityId: "source",
          isSystemAdmin: false,
          policyVersion: FACILITY_ACCESS_POLICY_VERSION,
          computedAt: new Date(),
          grants: [
            {
              facilityId: "source",
              facilityType: WarehouseType.MAIN,
              permissions: { "inventory.read": true },
              sources: [],
            },
          ],
        }),
      AuthorizationError,
    );
    assert.throws(
      () =>
        createAccessContext({
          actorId: "user-1",
          workplaceFacilityId: "source",
          isSystemAdmin: false,
          policyVersion: FACILITY_ACCESS_POLICY_VERSION,
          computedAt: new Date(),
          grants: [
            {
              facilityId: "source",
              facilityType: WarehouseType.MAIN,
              permissions: { "inventory.read": true },
              sources: [
                {
                  ...directSource("bad-office"),
                  office_id: "office-a",
                },
              ],
            },
          ],
        }),
      AuthorizationError,
    );
  });
});
