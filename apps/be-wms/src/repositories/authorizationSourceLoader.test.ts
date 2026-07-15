import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ActiveStatus,
  EmployeeProfileStatus,
  UserStatus,
  WarehouseType,
} from "@bduck/shared-types";
import { buildAccessContext } from "../services/authorization/accessContextBuilder.js";
import { AuthorizationService } from "../services/authorization/authorizationService.js";
import {
  loadAuthorizationRequestSourceFromReader,
  loadAuthorizationSourceSnapshotFromReader,
} from "./authorizationSourceLoader.js";
import {
  NOW,
  activeProfile,
  activeUser,
  assignment,
  config,
  createHarness,
  document,
  edge,
  facility,
  role,
  type HarnessState,
} from "./authorizationSourceTestHarness.js";

describe("authorization source identity", () => {
  it("returns an empty actor snapshot for invalid users or profiles", async () => {
    const cases: Array<{ state: HarnessState; assignmentReads: number }> = [
      { state: { user: null }, assignmentReads: 0 },
      { state: { user: activeUser(), profiles: [] }, assignmentReads: 1 },
      {
        state: {
          user: activeUser(),
          profiles: [
            activeProfile(),
            document("profile-b", { ...activeProfile().data }),
          ],
        },
        assignmentReads: 1,
      },
      {
        state: {
          user: activeUser(),
          profiles: [
            document("profile-a", {
              ...activeProfile().data,
              status: EmployeeProfileStatus.INACTIVE,
            }),
          ],
        },
        assignmentReads: 1,
      },
      {
        state: {
          user: document("user-a", {
            ...activeUser().data,
            status: UserStatus.SUSPENDED,
          }),
        },
        assignmentReads: 0,
      },
      {
        state: {
          user: activeUser("office-b"),
          profiles: [activeProfile("office-a")],
        },
        assignmentReads: 1,
      },
    ];

    for (const { state, assignmentReads } of cases) {
      const { calls, reader } = createHarness(state);
      const snapshot = await loadAuthorizationSourceSnapshotFromReader(
        reader,
        "user-a",
        NOW,
      );
      assert.equal(snapshot.actor, null);
      assert.equal(calls.assignments, assignmentReads);
      assert.deepEqual(snapshot.facilities, []);
    }
  });

  it("returns the canonical unfiltered request user from the same read", async () => {
    const sourceUser = document("user-a", {
      ...activeUser("main-a").data,
      id: "stale-embedded-id",
      mfa_enabled: true,
      custom_claim: "preserved",
    });
    const { calls, reader } = createHarness({
      user: sourceUser,
      profiles: [activeProfile("main-a")],
      facilities: [facility("main-a", WarehouseType.MAIN)],
    });
    const source = await loadAuthorizationRequestSourceFromReader(
      reader,
      "user-a",
      NOW,
    );

    assert.equal(calls.users, 1);
    assert.equal(source.requestUser?.id, "user-a");
    assert.equal(source.requestUser?.mfa_enabled, true);
    assert.equal(
      (source.requestUser as unknown as Record<string, unknown>).custom_claim,
      "preserved",
    );
    assert.equal(source.snapshot.actor?.id, "user-a");
  });

  it("loads only active workplace/direct facilities and normalizes timestamps", async () => {
    const timestamp = { toDate: () => new Date("2026-01-01T00:00:00.000Z") };
    const { calls, reader } = createHarness({
      user: activeUser("main-a"),
      profiles: [activeProfile("main-a")],
      assignments: [
        assignment("store-d", "reader", { valid_from: timestamp }),
        assignment("inactive-main", "reader", { is_active: false }),
        document("other-user", {
          ...assignment("other", "reader").data,
          user_id: "user-b",
        }),
      ],
      roles: [role(), role("unrelated", { "inventory.write": true })],
      facilities: [
        facility("main-a", WarehouseType.MAIN),
        facility("store-d", WarehouseType.STORE),
        facility("inactive-main", WarehouseType.MAIN, {
          status: ActiveStatus.INACTIVE,
        }),
      ],
    });
    const snapshot = await loadAuthorizationSourceSnapshotFromReader(
      reader,
      "user-a",
      NOW,
    );

    assert.deepEqual(
      snapshot.facilities.map(({ id }) => id),
      ["main-a", "store-d"],
    );
    assert.deepEqual(
      snapshot.roles.map(({ id }) => id),
      ["reader"],
    );
    assert.ok(
      snapshot.assignments.find(
        ({ warehouse_id }) => warehouse_id === "store-d",
      )?.valid_from instanceof Date,
    );
    assert.equal(calls.allFacilities, 0);
    assert.equal(calls.officeConfig, 0);
  });
});

describe("authorization source scope breadth", () => {
  it("loads every active facility only for an exact active global wildcard", async () => {
    const globalState: HarnessState = {
      user: activeUser(null),
      profiles: [],
      assignments: [assignment(null, "wildcard")],
      roles: [role("wildcard", { "*": true }, { name: "Custom" })],
      allFacilities: [
        facility("main-a", WarehouseType.MAIN),
        facility("store-a", WarehouseType.STORE),
        facility("office-a", WarehouseType.OFFICE),
        facility("deleted", WarehouseType.STORE, { is_deleted: true }),
        facility("inactive", WarehouseType.MAIN, {
          status: ActiveStatus.INACTIVE,
        }),
      ],
    };
    const wildcard = createHarness(globalState);
    const snapshot = await loadAuthorizationSourceSnapshotFromReader(
      wildcard.reader,
      "user-a",
      NOW,
    );
    assert.deepEqual(
      snapshot.facilities.map(({ id }) => id),
      ["main-a", "office-a", "store-a"],
    );
    assert.equal(wildcard.calls.allFacilities, 1);
    assert.equal(snapshot.actor?.workplace_facility_id, null);

    const namedAdmin = createHarness({
      ...globalState,
      assignments: [assignment(null, "admin")],
      roles: [role("admin", { "inventory.read": true }, { name: "ADMIN" })],
    });
    await loadAuthorizationSourceSnapshotFromReader(
      namedAdmin.reader,
      "user-a",
      NOW,
    );
    assert.equal(namedAdmin.calls.allFacilities, 0);
  });

  it("loads ALL MAIN/STORE candidates but never other offices", async () => {
    const { calls, reader } = createHarness({
      assignments: [assignment("office-a")],
      roles: [role()],
      facilities: [facility("office-a", WarehouseType.OFFICE)],
      officeConfig: config("ALL"),
      allFacilities: [
        facility("main-a", WarehouseType.MAIN),
        facility("store-a", WarehouseType.STORE),
        facility("office-b", WarehouseType.OFFICE),
      ],
    });
    const snapshot = await loadAuthorizationSourceSnapshotFromReader(
      reader,
      "user-a",
      NOW,
    );
    assert.deepEqual(
      snapshot.facilities.map(({ id }) => id),
      ["main-a", "office-a", "store-a"],
    );
    assert.equal(calls.allFacilities, 1);
  });

  it("loads only active SELECTED edge targets and integrates with builder", async () => {
    const timestamp = { toDate: () => new Date("2026-01-01T00:00:00.000Z") };
    const { calls, reader } = createHarness({
      assignments: [assignment("office-a")],
      roles: [role()],
      facilities: [
        facility("office-a", WarehouseType.OFFICE),
        facility("store-d", WarehouseType.STORE),
        facility("office-b", WarehouseType.OFFICE),
        facility("expired-main", WarehouseType.MAIN),
      ],
      officeConfig: config("SELECTED", { valid_from: timestamp }),
      officeEdges: [
        edge("store-d", { valid_from: timestamp }),
        edge("office-b"),
        edge("expired-main", { valid_until: "2026-07-14" }),
      ],
    });
    const snapshot = await loadAuthorizationSourceSnapshotFromReader(
      reader,
      "user-a",
      NOW,
    );
    assert.deepEqual(
      snapshot.facilities.map(({ id }) => id),
      ["office-a", "store-d"],
    );
    assert.deepEqual(calls.facilityIds, [
      ["office-a"],
      ["office-b", "store-d"],
    ]);
    assert.equal(calls.allFacilities, 0);
    assert.ok(snapshot.officeScopeConfigs[0].valid_from instanceof Date);
    const service = new AuthorizationService(buildAccessContext(snapshot));
    assert.equal(service.can("inventory.read", "store-d"), true);
    assert.equal(service.can("inventory.read", "office-b"), false);
  });

  it("never turns missing config dates into ALL scope", async () => {
    const malformedConfig = config("ALL");
    const malformedData = { ...malformedConfig.data };
    delete malformedData.valid_from;
    delete malformedData.valid_until;
    const { calls, reader } = createHarness({
      assignments: [assignment("office-a")],
      roles: [role()],
      facilities: [facility("office-a", WarehouseType.OFFICE)],
      officeConfig: document("office-a", malformedData),
      allFacilities: [facility("store-a", WarehouseType.STORE)],
    });
    const snapshot = await loadAuthorizationSourceSnapshotFromReader(
      reader,
      "user-a",
      NOW,
    );
    assert.equal(calls.allFacilities, 0);
    assert.deepEqual(
      snapshot.facilities.map(({ id }) => id),
      ["office-a"],
    );
  });
});
