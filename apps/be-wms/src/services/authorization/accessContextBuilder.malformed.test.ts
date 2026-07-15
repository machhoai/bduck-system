import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WarehouseType } from "@bduck/shared-types";
import { buildAccessContext } from "./accessContextBuilder.js";
import { AuthorizationService } from "./authorizationService.js";
import {
  createActor,
  createAssignment,
  createFacility,
  createRole,
  createSnapshot,
} from "./authorizationTestFixtures.js";

describe("malformed authorization source data", () => {
  it("fails closed for malformed calendar dates and ambiguous timestamps", () => {
    const reader = createRole("reader", { "inventory.read": true });
    const invalidWindows = [
      { valid_from: "2026-02-30" },
      { valid_until: "2026-99-99" },
      { valid_until: "2026-02-30T00:00:00Z" },
      { valid_until: "07/15/2026" },
    ];

    invalidWindows.forEach((window, index) => {
      const context = buildAccessContext(
        createSnapshot({
          actor: createActor({ workplace_facility_id: "main-a" }),
          facilities: [
            createFacility("main-a", WarehouseType.MAIN),
            createFacility("store-d", WarehouseType.STORE),
          ],
          roles: [reader],
          assignments: [
            createAssignment(`invalid-${index}`, "store-d", reader.id, window),
          ],
        }),
      );
      assert.equal(
        new AuthorizationService(context).can("inventory.read", "store-d"),
        false,
      );
    });
  });

  it("rejects corrupt origins and assignment activity flags", () => {
    const reader = createRole("reader", { "inventory.read": true });
    const wildcard = createRole("wildcard", { "*": true });
    const context = buildAccessContext(
      createSnapshot({
        actor: createActor({ workplace_facility_id: "main-a" }),
        facilities: [
          createFacility("main-a", WarehouseType.MAIN),
          createFacility("store-d", WarehouseType.STORE),
        ],
        roles: [reader, wildcard],
        assignments: [
          createAssignment("bad-direct", "store-d", reader.id, {
            scope_origin: "CORRUPT" as never,
          }),
          createAssignment("bad-global", null, wildcard.id, {
            scope_origin: "CORRUPT" as never,
          }),
          createAssignment("bad-active", null, wildcard.id, {
            is_active: "true" as never,
          }),
          createAssignment("bad-delete", null, wildcard.id, {
            is_deleted: "false" as never,
          }),
        ],
      }),
    );

    assert.equal(context.isSystemAdmin, false);
    assert.deepEqual(Object.keys(context.grants), []);
  });
});
