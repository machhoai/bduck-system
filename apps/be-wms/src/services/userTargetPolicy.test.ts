import assert from "node:assert/strict";
import test from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type UserWarehouseRole,
} from "@bduck/shared-types";
import {
  AuthorizationError,
  AuthorizationService,
  createAccessContext,
} from "./authorization/index.js";
import {
  assertCanAccessTargetUser,
  canAccessTargetUser,
} from "./userTargetPolicy.js";

const authorization = new AuthorizationService(
  createAccessContext({
    actorId: "office-manager",
    workplaceFacilityId: "office-b",
    isSystemAdmin: false,
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt: new Date("2026-07-15T00:00:00.000Z"),
    grants: [
      {
        facilityId: "store-d",
        facilityType: WarehouseType.STORE,
        permissions: { "users.read": true, "users.write": true },
        sources: [
          {
            type: "OFFICE_INHERITED",
            role_id: "manager",
            assignment_id: "assignment-manager",
            office_id: "office-b",
          },
        ],
      },
    ],
  }),
);

const globalAssignment: UserWarehouseRole = {
  id: "global-assignment",
  user_id: "target",
  warehouse_id: null,
  role_id: "global-role",
  assigned_by: "system-admin",
  valid_from: "2026-01-01",
  valid_until: null,
  is_active: true,
  is_deleted: false,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

test("allows target users only inside the actor facility scope", () => {
  assert.equal(
    canAccessTargetUser(
      authorization,
      "users.read",
      { workplace_facility_id: "store-d" },
      [],
    ),
    true,
  );
  assert.equal(
    canAccessTargetUser(
      authorization,
      "users.read",
      { workplace_facility_id: "warehouse-e" },
      [],
    ),
    false,
  );
});

test("prevents office managers from modifying global accounts", () => {
  assert.throws(
    () =>
      assertCanAccessTargetUser(
        authorization,
        "users.write",
        { workplace_facility_id: "store-d" },
        [globalAssignment],
      ),
    AuthorizationError,
  );
});
