import assert from "node:assert/strict";
import test from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
} from "@bduck/shared-types";
import {
  AuthorizationError,
  AuthorizationService,
  createAccessContext,
} from "./authorization/index.js";
import { assertCanDelegateRole } from "./roleDelegationPolicy.js";

const service = (permissions: Record<string, boolean>) =>
  new AuthorizationService(
    createAccessContext({
      actorId: "manager-a",
      workplaceFacilityId: "office-b",
      isSystemAdmin: false,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date("2026-07-15T00:00:00.000Z"),
      grants: [
        {
          facilityId: "warehouse-c",
          facilityType: WarehouseType.MAIN,
          permissions,
          sources: [
            {
              type: "OFFICE_INHERITED",
              role_id: "manager-role",
              assignment_id: "manager-assignment",
              office_id: "office-b",
            },
          ],
        },
      ],
    }),
  );

test("allows only permissions the delegating manager owns", () => {
  const authorization = service({
    "users.assign_role": true,
    "inventory.read": true,
  });

  assert.doesNotThrow(() =>
    assertCanDelegateRole(authorization, "warehouse-c", {
      permissions: { "inventory.read": true },
    }),
  );
  assert.throws(
    () =>
      assertCanDelegateRole(authorization, "warehouse-c", {
        permissions: { "inventory.write": true },
      }),
    AuthorizationError,
  );
});

test("denies facilities outside scope and wildcard delegation", () => {
  const authorization = service({
    "users.assign_role": true,
    "inventory.read": true,
  });

  assert.throws(
    () =>
      assertCanDelegateRole(authorization, "warehouse-e", {
        permissions: { "inventory.read": true },
      }),
    AuthorizationError,
  );
  assert.throws(
    () =>
      assertCanDelegateRole(authorization, "warehouse-c", {
        permissions: { "*": true },
      }),
    AuthorizationError,
  );
});

test("reserves global assignments for exact system administrators", () => {
  assert.throws(
    () =>
      assertCanDelegateRole(service({ "users.assign_role": true }), null, {
        permissions: { "inventory.read": true },
      }),
    AuthorizationError,
  );
});
