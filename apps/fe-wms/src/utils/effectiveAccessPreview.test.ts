import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ActiveStatus,
  WarehouseType,
  type Role,
  type Warehouse,
} from "@bduck/shared-types";
import { buildEffectiveAccessPreview } from "./effectiveAccessPreview";

const facilities = [
  { id: "office-a", name: "Office A", type: WarehouseType.OFFICE },
  { id: "office-b", name: "Office B", type: WarehouseType.OFFICE },
  { id: "warehouse-c", name: "Kho C", type: WarehouseType.MAIN },
  { id: "store-d", name: "Cửa hàng D", type: WarehouseType.STORE },
].map(
  (facility) =>
    ({
      ...facility,
      status: ActiveStatus.ACTIVE,
      is_deleted: false,
    }) as Warehouse,
);

const roles: Role[] = [
  {
    id: "manager",
    name: "Manager",
    description: null,
    color: "#000000",
    parent_id: null,
    permissions: { "inventory.read": true },
    board_position: null,
    is_deleted: false,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "system-admin",
    name: "System Admin",
    description: null,
    color: "#000000",
    parent_id: null,
    permissions: { "*": true },
    board_position: null,
    is_deleted: false,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const assignment = (
  warehouseId: string,
  roleId = "manager",
  scopeOrigin: "DIRECT" | "LEGACY_DIRECT" = "DIRECT",
) => ({
  warehouse_id: warehouseId,
  role_id: roleId,
  valid_from: "2026-01-01",
  valid_until: "",
  is_active: true,
  scope_origin: scopeOrigin,
});

describe("buildEffectiveAccessPreview", () => {
  it("previews an Office role at the workplace as direct plus inherited scope", () => {
    const result = buildEffectiveAccessPreview({
      workplaceFacilityId: "office-a",
      assignments: [assignment("office-a")],
      roles,
      facilities,
      inheritedFacilityIds: ["warehouse-c", "store-d"],
      today: "2026-07-20",
    });

    assert.deepEqual(result, [
      { facilityId: "office-a", sourceTypes: ["DIRECT"] },
      { facilityId: "warehouse-c", sourceTypes: ["OFFICE_INHERITED"] },
      { facilityId: "store-d", sourceTypes: ["OFFICE_INHERITED"] },
    ]);
  });

  it("keeps a Store assignment direct when the workplace is an Office", () => {
    const result = buildEffectiveAccessPreview({
      workplaceFacilityId: "office-a",
      assignments: [assignment("store-d")],
      roles,
      facilities,
      inheritedFacilityIds: ["warehouse-c", "store-d"],
      today: "2026-07-20",
    });

    assert.deepEqual(result, [
      { facilityId: "store-d", sourceTypes: ["DIRECT"] },
    ]);
  });

  it("does not infer Office inheritance from a legacy assignment", () => {
    const result = buildEffectiveAccessPreview({
      workplaceFacilityId: "office-a",
      assignments: [assignment("office-a", "manager", "LEGACY_DIRECT")],
      roles,
      facilities,
      inheritedFacilityIds: ["warehouse-c", "store-d"],
      today: "2026-07-20",
    });

    assert.deepEqual(result, [
      { facilityId: "office-a", sourceTypes: ["LEGACY_DIRECT"] },
    ]);
  });

  it("ignores a non-wildcard role with Global scope", () => {
    const result = buildEffectiveAccessPreview({
      workplaceFacilityId: "office-a",
      assignments: [assignment("", "manager")],
      roles,
      facilities,
      inheritedFacilityIds: ["warehouse-c", "store-d"],
      today: "2026-07-20",
    });

    assert.deepEqual(result, []);
  });

  it("previews a wildcard Global role across every active facility", () => {
    const result = buildEffectiveAccessPreview({
      workplaceFacilityId: "store-d",
      assignments: [assignment("", "system-admin")],
      roles,
      facilities,
      inheritedFacilityIds: [],
      today: "2026-07-20",
    });

    assert.deepEqual(
      result.map((grant) => grant.facilityId),
      facilities.map((facility) => facility.id),
    );
    assert.ok(
      result.every((grant) => grant.sourceTypes.join() === "SYSTEM_GLOBAL"),
    );
  });
});
