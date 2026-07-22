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
import {
  assertAnyAttendanceAction,
  assertPersonalAttendanceAction,
  buildAttendanceCapabilities,
} from "./attendanceAuthorizationPolicy.js";

const inheritedAuthorization = new AuthorizationService(
  createAccessContext({
    actorId: "office-manager",
    workplaceFacilityId: "office-a",
    isSystemAdmin: false,
    policyVersion: FACILITY_ACCESS_POLICY_VERSION,
    computedAt: new Date("2026-07-22T00:00:00.000Z"),
    grants: [
      {
        facilityId: "warehouse-c",
        facilityType: WarehouseType.MAIN,
        permissions: {
          "attendance.check_in": true,
          "attendance.view": true,
          "attendance.config": true,
        },
        sources: [
          {
            type: "OFFICE_INHERITED",
            role_id: "attendance-manager",
            assignment_id: "attendance-assignment",
            office_id: "office-a",
          },
        ],
      },
    ],
  }),
);

test("uses effective inherited facilities for attendance page capabilities", () => {
  assert.doesNotThrow(() => assertAnyAttendanceAction(inheritedAuthorization));
  assert.deepEqual(buildAttendanceCapabilities(inheritedAuthorization, null), {
    canCheckIn: false,
    canView: true,
    canConfigure: true,
    canExport: false,
    canAccessWorkplace: false,
  });
});

test("authorizes personal attendance only at the employee profile facility", () => {
  assert.equal(
    buildAttendanceCapabilities(inheritedAuthorization, "warehouse-c")
      .canCheckIn,
    true,
  );
  assert.equal(
    buildAttendanceCapabilities(inheritedAuthorization, "warehouse-c")
      .canAccessWorkplace,
    true,
  );
  assert.doesNotThrow(() =>
    assertPersonalAttendanceAction(
      inheritedAuthorization,
      "attendance.check_in",
      "warehouse-c",
    ),
  );
  assert.throws(
    () =>
      assertPersonalAttendanceAction(
        inheritedAuthorization,
        "attendance.check_in",
        "warehouse-outside-scope",
      ),
    AuthorizationError,
  );
});

test("allows a system administrator without a canonical workplace to load context", () => {
  const authorization = new AuthorizationService(
    createAccessContext({
      actorId: "system-admin",
      workplaceFacilityId: null,
      isSystemAdmin: true,
      systemAdminSources: [
        {
          type: "SYSTEM_GLOBAL",
          role_id: "system-admin-role",
          assignment_id: "system-admin-assignment",
          office_id: null,
        },
      ],
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date("2026-07-22T00:00:00.000Z"),
      grants: [],
    }),
  );

  assert.doesNotThrow(() => assertAnyAttendanceAction(authorization));
  assert.deepEqual(buildAttendanceCapabilities(authorization, null), {
    canCheckIn: false,
    canView: true,
    canConfigure: true,
    canExport: true,
    canAccessWorkplace: false,
  });
});
