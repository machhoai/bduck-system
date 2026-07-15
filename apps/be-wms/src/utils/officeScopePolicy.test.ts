import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ActiveStatus,
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type OfficeScopeConfig,
  type OfficeScopeEdge,
} from "@bduck/shared-types";
import { officeScopeMutationSchema } from "./facilityAccessSchemas.js";
import {
  assertOfficeScopeFacilities,
  assertOfficeScopeWriteStructure,
  assertPersistedOfficeScopeEdgeOwner,
  collectAllModeSoftDeleteEdgeIds,
  type OfficeScopeFacilityState,
} from "./officeScopePolicy.js";

const now = new Date("2026-07-15T00:00:00.000Z");

const createConfig = (
  scopeMode: OfficeScopeConfig["scope_mode"] = "SELECTED",
): OfficeScopeConfig => ({
  id: "office-a",
  office_id: "office-a",
  scope_mode: scopeMode,
  is_active: true,
  is_deleted: false,
  policy_version: FACILITY_ACCESS_POLICY_VERSION,
  revision: 1,
  valid_from: null,
  valid_until: null,
  created_by: "user-a",
  updated_by: "user-a",
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});

const createEdge = (targetFacilityId = "warehouse-c"): OfficeScopeEdge => ({
  id: `office-a:${targetFacilityId}`,
  office_id: "office-a",
  target_facility_id: targetFacilityId,
  is_active: true,
  is_deleted: false,
  valid_from: null,
  valid_until: null,
  created_by: "user-a",
  updated_by: "user-a",
  created_at: now,
  updated_at: now,
  action_time: now,
  sync_time: now,
});

const createFacility = (
  id: string,
  type: WarehouseType,
  overrides: Partial<OfficeScopeFacilityState> = {},
): OfficeScopeFacilityState => ({
  id,
  type,
  status: ActiveStatus.ACTIVE,
  is_deleted: false,
  ...overrides,
});

const expectErrorCode = (callback: () => void, code: string): void => {
  assert.throws(callback, (error: Error) => error.message === code);
};

describe("office scope facility topology", () => {
  const edge = createEdge();
  const targets = new Map([
    [
      edge.target_facility_id,
      createFacility(edge.target_facility_id, WarehouseType.MAIN),
    ],
  ]);

  it("rejects missing, deleted, inactive, mismatched and non-office sources", () => {
    const cases: Array<[OfficeScopeFacilityState | null, string]> = [
      [null, "OFFICE_SCOPE_OFFICE_NOT_FOUND"],
      [
        createFacility("office-a", WarehouseType.OFFICE, { is_deleted: true }),
        "OFFICE_SCOPE_OFFICE_DELETED",
      ],
      [
        createFacility("office-a", WarehouseType.OFFICE, {
          status: ActiveStatus.INACTIVE,
        }),
        "OFFICE_SCOPE_OFFICE_INACTIVE",
      ],
      [
        createFacility("office-b", WarehouseType.OFFICE),
        "OFFICE_SCOPE_OFFICE_ID_MISMATCH",
      ],
      [
        createFacility("office-a", WarehouseType.MAIN),
        "OFFICE_SCOPE_SOURCE_MUST_BE_OFFICE",
      ],
    ];

    cases.forEach(([source, code]) => {
      expectErrorCode(
        () => assertOfficeScopeFacilities("office-a", source, [edge], targets),
        code,
      );
    });
  });

  it("accepts MAIN and STORE targets but rejects invalid target states", () => {
    const office = createFacility("office-a", WarehouseType.OFFICE);
    [WarehouseType.MAIN, WarehouseType.STORE].forEach((type) => {
      assert.doesNotThrow(() =>
        assertOfficeScopeFacilities(
          "office-a",
          office,
          [edge],
          new Map([
            [edge.target_facility_id, createFacility("warehouse-c", type)],
          ]),
        ),
      );
    });

    const cases: Array<[OfficeScopeFacilityState | null, string]> = [
      [null, "OFFICE_SCOPE_TARGET_NOT_FOUND"],
      [
        createFacility("warehouse-c", WarehouseType.MAIN, {
          is_deleted: true,
        }),
        "OFFICE_SCOPE_TARGET_DELETED",
      ],
      [
        createFacility("warehouse-c", WarehouseType.MAIN, {
          status: ActiveStatus.INACTIVE,
        }),
        "OFFICE_SCOPE_TARGET_INACTIVE",
      ],
      [
        createFacility("warehouse-c", WarehouseType.OFFICE),
        "OFFICE_SCOPE_TARGET_TYPE_NOT_MANAGEABLE",
      ],
    ];
    cases.forEach(([target, code]) => {
      expectErrorCode(
        () =>
          assertOfficeScopeFacilities(
            "office-a",
            office,
            [edge],
            new Map([[edge.target_facility_id, target]]),
          ),
        code,
      );
    });
  });
});

describe("office scope write invariants", () => {
  it("requires ALL mutations to have no explicit targets or edge writes", () => {
    assert.equal(
      officeScopeMutationSchema.safeParse({
        scope_mode: "ALL",
        target_facility_ids: ["warehouse-c"],
      }).success,
      false,
    );
    expectErrorCode(
      () =>
        assertOfficeScopeWriteStructure(
          createConfig("ALL"),
          [createEdge()],
          [],
        ),
      "OFFICE_SCOPE_ALL_EDGES_NOT_ALLOWED",
    );
  });

  it("blocks self targets and invalid edge validity windows", () => {
    expectErrorCode(
      () =>
        assertOfficeScopeWriteStructure(
          createConfig(),
          [createEdge("office-a")],
          [],
        ),
      "OFFICE_SCOPE_EDGE_SELF_TARGET_NOT_ALLOWED",
    );
    expectErrorCode(
      () =>
        assertOfficeScopeWriteStructure(
          createConfig(),
          [
            {
              ...createEdge(),
              valid_from: now,
              valid_until: new Date("2026-07-14T00:00:00.000Z"),
            },
          ],
          [],
        ),
      "OFFICE_SCOPE_EDGE_INVALID_VALIDITY_RANGE",
    );
  });

  it("soft-deactivates every active nondeleted persisted edge in ALL mode", () => {
    assert.deepEqual(
      collectAllModeSoftDeleteEdgeIds(createConfig("ALL"), [
        {
          id: "edge-b",
          office_id: "office-a",
          is_active: true,
          is_deleted: false,
        },
        {
          id: "edge-a",
          office_id: "office-a",
          is_active: true,
          is_deleted: false,
        },
        {
          id: "inactive",
          office_id: "office-a",
          is_active: false,
          is_deleted: false,
        },
        {
          id: "deleted",
          office_id: "office-a",
          is_active: true,
          is_deleted: true,
        },
      ]),
      ["edge-a", "edge-b"],
    );
    assert.deepEqual(
      collectAllModeSoftDeleteEdgeIds(createConfig("SELECTED"), [
        {
          id: "edge-a",
          office_id: "office-a",
          is_active: true,
          is_deleted: false,
        },
      ]),
      [],
    );
  });

  it("rejects persisted edges owned by another office", () => {
    expectErrorCode(
      () =>
        collectAllModeSoftDeleteEdgeIds(createConfig("ALL"), [
          {
            id: "edge-a",
            office_id: "office-b",
            is_active: true,
            is_deleted: false,
          },
        ]),
      "OFFICE_SCOPE_EDGE_OWNER_MISMATCH",
    );
  });

  it("keeps SELECTED edge writes ownership-safe", () => {
    assert.doesNotThrow(() =>
      assertPersistedOfficeScopeEdgeOwner(false, undefined, "office-a", true),
    );
    expectErrorCode(
      () =>
        assertPersistedOfficeScopeEdgeOwner(
          false,
          undefined,
          "office-a",
          false,
        ),
      "OFFICE_SCOPE_EDGE_NOT_FOUND",
    );
    expectErrorCode(
      () =>
        assertPersistedOfficeScopeEdgeOwner(true, "office-b", "office-a", true),
      "OFFICE_SCOPE_EDGE_OWNER_MISMATCH",
    );
  });
});
